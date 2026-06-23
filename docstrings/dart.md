# Dart Doc — Dart

Delimiter: `///` (triple-slash) with markdown-based descriptions.

```dart
/// Processes a payment order and returns a confirmation receipt.
///
/// The [orderId] must be non-empty and [amount] must be positive.
/// Returns a [Receipt] containing the status and receipt ID.
///
/// Throws [ArgumentError] if [orderId] is empty or [amount] is not positive.
/// Throws [PaymentGatewayException] if the upstream processor is unavailable.
///
/// - Side effects (compliance-relevant): Writes to payment audit log; calls external payment gateway.
/// - Tenant context: Scoped to the authenticated tenant's payment account.
/// - Compliance mode (when stricter than ambient): PCI-DSS scope — card data must not appear in logs.
Future<Receipt> processOrder(String orderId, double amount) async {
```
