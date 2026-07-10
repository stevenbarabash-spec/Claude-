import Foundation
import Contacts

/// Resolves spoken names ("text Mike") to real phone numbers and email
/// addresses from the user's contacts.
struct ContactsService {

    struct Match {
        let name: String
        let phone: String?
        let email: String?
    }

    static func resolve(name: String) async -> Match? {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("@") else { return nil }

        let store = CNContactStore()
        let granted = (try? await store.requestAccess(for: .contacts)) ?? false
        guard granted else { return nil }

        let keys = [
            CNContactGivenNameKey, CNContactFamilyNameKey,
            CNContactPhoneNumbersKey, CNContactEmailAddressesKey,
        ] as [CNKeyDescriptor]

        let predicate = CNContact.predicateForContacts(matchingName: trimmed)
        guard let contacts = try? store.unifiedContacts(matching: predicate, keysToFetch: keys),
              let contact = contacts.first
        else { return nil }

        return Match(
            name: "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces),
            phone: contact.phoneNumbers.first?.value.stringValue,
            email: contact.emailAddresses.first.map { String($0.value) }
        )
    }
}
