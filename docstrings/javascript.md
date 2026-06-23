# JSDoc — JavaScript

Delimiter: `/** ... */`

```javascript
/**
 * Process a payment order and return a confirmation receipt.
 *
 * @param {string} orderId - Unique identifier for the order. Must be non-empty.
 * @param {number} amount - Payment amount in base currency. Must be > 0.
 * @returns {Promise<{status: string, receiptId: string}>} Receipt with status and ID.
 * @throws {Error} If orderId is empty or amount is not positive.
 *
 * @example
 * const receipt = await processOrder("ord_123", 49.99);
 *
 * Side effects (compliance-relevant): Writes to payment audit log; calls external payment gateway.
 * Tenant context: Scoped to the authenticated tenant's payment account.
 * Compliance mode (when stricter than ambient): PCI-DSS scope — card data must not appear in logs.
 */
async function processOrder(orderId, amount) {
```
