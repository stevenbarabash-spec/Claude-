import Foundation
import HomeKit

/// Voice control of HomeKit scenes and accessories — one of the few places
/// iOS lets an app act with no confirmation step at all.
final class HomeController: NSObject, HMHomeManagerDelegate {

    static let shared = HomeController()

    private let manager = HMHomeManager()
    private var readyContinuations: [CheckedContinuation<Void, Never>] = []
    private var isReady = false

    private override init() {
        super.init()
        manager.delegate = self
    }

    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        isReady = true
        readyContinuations.forEach { $0.resume() }
        readyContinuations.removeAll()
    }

    private func waitUntilReady() async {
        if isReady { return }
        await withCheckedContinuation { continuation in
            if isReady { continuation.resume() } else { readyContinuations.append(continuation) }
        }
    }

    /// Executes a natural-language home command: first tries to match a scene
    /// name ("movie night"), then an accessory power toggle ("turn off the
    /// living room lights"). Returns a spoken confirmation.
    func execute(_ command: String) async -> String {
        await waitUntilReady()
        guard let home = manager.primaryHome ?? manager.homes.first else {
            return "I couldn't find a HomeKit home on this device. Set one up in the Home app first."
        }

        let lower = command.lowercased()

        // 1. Scene match.
        if let scene = home.actionSets.first(where: { lower.contains($0.name.lowercased()) }) {
            do {
                try await home.executeActionSet(scene)
                return "Running \(scene.name)."
            } catch {
                return "I found the scene \(scene.name) but couldn't run it: \(error.localizedDescription)"
            }
        }

        // 2. Accessory power toggle.
        let turnOn = lower.contains(" on") || lower.hasPrefix("on ") || lower.contains("turn on")
        let turnOff = lower.contains(" off") || lower.contains("turn off")
        guard turnOn || turnOff else {
            let scenes = home.actionSets.map(\.name).joined(separator: ", ")
            return scenes.isEmpty
                ? "I couldn't match that to a scene or a switch."
                : "I couldn't match that. Your scenes are: \(scenes)."
        }

        var toggled: [String] = []
        for accessory in home.accessories {
            let names = [accessory.name.lowercased()]
                + accessory.services.map { $0.name.lowercased() }
            guard names.contains(where: { !$0.isEmpty && lower.contains($0) }) else { continue }

            for service in accessory.services {
                for characteristic in service.characteristics
                where characteristic.characteristicType == HMCharacteristicTypePowerState {
                    try? await characteristic.writeValue(turnOn)
                    toggled.append(accessory.name)
                }
            }
        }

        if toggled.isEmpty {
            return "I couldn't find an accessory matching that name."
        }
        let list = Set(toggled).joined(separator: ", ")
        return "Turned \(turnOn ? "on" : "off") \(list)."
    }
}
