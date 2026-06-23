# Doxygen — C++

Delimiter: `/** ... */` with `@brief`, `@param`, `@return`, `@throws`.

```cpp
/**
 * @brief Process a payment order and return a confirmation receipt.
 *
 * @param order_id  Unique order identifier. Must not be empty.
 * @param amount    Payment amount in base currency. Must be > 0.
 * @return A Receipt containing status and receipt_id on success.
 * @throws std::invalid_argument If order_id is empty or amount is not positive.
 * @throws PaymentGatewayException If the upstream processor is unavailable.
 *
 * @note This method is thread-safe.
 *
 * @code
 * auto receipt = service.processOrder("ord_123", 49.99);
 * std::cout << receipt.status << '\n';
 * @endcode
 *
 * Side effects (compliance-relevant): Writes to payment audit log; calls external payment gateway.
 * Tenant context: Scoped to the authenticated tenant's payment account.
 * Compliance mode (when stricter than ambient): PCI-DSS scope — card data must not appear in logs.
 */
Receipt processOrder(const std::string& order_id, double amount);
```
