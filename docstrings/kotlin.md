# KDoc — Kotlin

Delimiter: `/** ... */` with `@param`, `@return`, `@throws` tags.

```kotlin
/**
 * Processes a payment order and returns a confirmation receipt.
 *
 * @param orderId unique identifier for the order; must not be blank
 * @param amount payment amount in the account's base currency; must be > 0
 * @return a [Receipt] containing the status and receipt ID
 * @throws IllegalArgumentException if orderId is blank or amount is not positive
 * @throws PaymentGatewayException if the upstream processor is unavailable
 *
 * - Side effects (compliance-relevant): Writes to payment audit log; calls external payment gateway.
 * - Tenant context: Scoped to the authenticated tenant's payment account.
 * - Compliance mode (when stricter than ambient): PCI-DSS scope — card data must not appear in logs.
 */
fun processOrder(orderId: String, amount: Double): Receipt {
```
