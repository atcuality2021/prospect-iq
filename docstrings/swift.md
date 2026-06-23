# Swift DocC — Swift

Delimiter: `///` (triple-slash) with structured keywords.

```swift
/// Processes a payment order and returns a confirmation receipt.
///
/// - Parameters:
///   - orderId: Unique identifier for the order. Must be non-empty.
///   - amount: Payment amount in the account's base currency. Must be > 0.
/// - Returns: A `Receipt` containing the status and receipt ID.
/// - Throws: `PaymentError.invalidOrder` if orderId is empty or amount is not positive.
///
/// - Side effects (compliance-relevant): Writes to payment audit log; calls external payment gateway.
/// - Tenant context: Scoped to the authenticated tenant's payment account.
/// - Compliance mode (when stricter than ambient): PCI-DSS scope — card data must not appear in logs.
func processOrder(orderId: String, amount: Double) throws -> Receipt {
```
