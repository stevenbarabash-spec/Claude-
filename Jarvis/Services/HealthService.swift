import Foundation
import HealthKit

/// Read-only HealthKit summaries: sleep, workouts, and steps over the last
/// 7 days, formatted as plain text for Claude to narrate.
final class HealthService {

    static let shared = HealthService()
    private let store = HKHealthStore()

    enum HealthError: LocalizedError {
        case unavailable
        var errorDescription: String? { "Health data isn't available on this device." }
    }

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) { types.insert(steps) }
        return types
    }

    func weeklySummaryText() async throws -> String {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthError.unavailable }
        try await store.requestAuthorization(toShare: [], read: readTypes)

        let end = Date()
        let start = Calendar.current.date(byAdding: .day, value: -7, to: end)!
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end)

        async let sleep = averageNightlySleep(predicate: predicate)
        async let workouts = workoutSummary(predicate: predicate)
        async let steps = dailyAverageSteps(start: start, end: end)

        return """
        Last 7 days:
        - Average sleep per night: \(try await sleep)
        - Workouts: \(try await workouts)
        - Average daily steps: \(try await steps)
        """
    }

    private func averageNightlySleep(predicate: NSPredicate) async throws -> String {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { return "no data" }
        let samples: [HKCategorySample] = try await querySamples(type: type, predicate: predicate)
        let asleepValues = Set(HKCategoryValueSleepAnalysis.allAsleepValues.map(\.rawValue))
        let totalSeconds = samples
            .filter { asleepValues.contains($0.value) }
            .reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
        guard totalSeconds > 0 else { return "no data" }
        let perNight = totalSeconds / 7
        return String(format: "%.1f hours", perNight / 3600)
    }

    private func workoutSummary(predicate: NSPredicate) async throws -> String {
        let workouts: [HKWorkout] = try await querySamples(type: .workoutType(), predicate: predicate)
        guard !workouts.isEmpty else { return "none logged" }
        let minutes = Int(workouts.reduce(0.0) { $0 + $1.duration } / 60)
        return "\(workouts.count) sessions, \(minutes) minutes total"
    }

    private func dailyAverageSteps(start: Date, end: Date) async throws -> String {
        guard let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else { return "no data" }
        return try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            let query = HKStatisticsQuery(quantityType: type,
                                          quantitySamplePredicate: predicate,
                                          options: .cumulativeSum) { _, stats, error in
                if let error { continuation.resume(throwing: error); return }
                let total = stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0
                continuation.resume(returning: total > 0 ? "\(Int(total / 7))" : "no data")
            }
            store.execute(query)
        }
    }

    private func querySamples<T: HKSample>(type: HKSampleType, predicate: NSPredicate) async throws -> [T] {
        try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type,
                                      predicate: predicate,
                                      limit: HKObjectQueryNoLimit,
                                      sortDescriptors: nil) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                continuation.resume(returning: (samples as? [T]) ?? [])
            }
            store.execute(query)
        }
    }
}
