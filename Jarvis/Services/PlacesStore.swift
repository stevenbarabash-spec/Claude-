import Foundation
import CoreLocation

/// Saved places ("home", "work") used for location-triggered reminders.
/// Captured once in Settings from the device's current location.
struct SavedPlace: Codable {
    let name: String
    let latitude: Double
    let longitude: Double
}

enum PlacesStore {
    private static let key = "savedPlaces"

    static func all() -> [SavedPlace] {
        guard let data = UserDefaults.standard.data(forKey: key),
              let places = try? JSONDecoder().decode([SavedPlace].self, from: data)
        else { return [] }
        return places
    }

    static func place(named name: String) -> SavedPlace? {
        all().first { $0.name.lowercased() == name.lowercased() }
    }

    static func save(name: String, coordinate: CLLocationCoordinate2D) {
        var places = all().filter { $0.name.lowercased() != name.lowercased() }
        places.append(SavedPlace(name: name.lowercased(),
                                 latitude: coordinate.latitude,
                                 longitude: coordinate.longitude))
        if let data = try? JSONEncoder().encode(places) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}

/// One-shot current-location fetch for saving places in Settings.
final class LocationFetcher: NSObject, CLLocationManagerDelegate {

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    enum LocationError: LocalizedError {
        case denied
        var errorDescription: String? { "Location permission was denied. Enable it in Settings → Privacy." }
    }

    func currentLocation() async throws -> CLLocationCoordinate2D {
        manager.delegate = self
        manager.requestWhenInUseAuthorization()
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if let coordinate = locations.first?.coordinate {
            continuation?.resume(returning: coordinate)
            continuation = nil
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}
