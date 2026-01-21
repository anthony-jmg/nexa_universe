# Withdrawal Right Waiver System

## Overview

This system implements EU-compliant anti-abuse protection for the 14-day withdrawal period. Users automatically lose their right to a refund if they use subscription benefits during the withdrawal period.

## Legal Basis

**EU Directive 2011/83/EU Article 16(m):**
> "The consumer shall lose the right of withdrawal if they have expressly requested to begin the performance of services before the end of the 14-day withdrawal period and have acknowledged that they will thereby lose their right of withdrawal."

By using subscription benefits (discounts, exclusive content), users implicitly request service performance, which automatically waives their withdrawal right.

## How It Works

### Automatic Waiver Triggers

The system automatically tracks when users use subscription benefits:

#### Platform Subscription
- **Using subscriber discount** on any purchase (programs, videos, products)
- Waiver reason stored: `used_discount_on_program_purchase` or `used_discount_on_video_purchase`

#### Professor Subscription
- **Using professor discount** on any purchase
- Waiver reason stored: Same as platform

### Database Tracking

#### Fields Added to `profiles` table:
```sql
- platform_withdrawal_right_waived: boolean
- platform_withdrawal_waived_at: timestamptz
- platform_withdrawal_waiver_reason: text
```

#### Fields Added to `professor_subscriptions` table:
```sql
- withdrawal_right_waived: boolean
- withdrawal_waived_at: timestamptz
- withdrawal_waiver_reason: text
```

### Automatic Triggers

Two database triggers automatically detect benefit usage:

1. **`trigger_waive_on_program_purchase`**
   - Fires when a program is purchased
   - Compares price paid vs. full price
   - If discount detected (difference > €0.01), waives withdrawal right

2. **`trigger_waive_on_video_purchase`**
   - Fires when a video is purchased
   - Same logic as program purchase trigger

## Refund Calculation

Two database functions calculate refunds considering waiver status:

### `calculate_platform_refund_amount(user_id)`
```sql
Returns:
- Full subscription price: If within 14 days AND not waived
- 0: If waived OR outside 14-day period
```

### `calculate_professor_refund_amount(user_id, professor_id)`
```sql
Returns:
- Full subscription price: If within 14 days AND not waived
- 0: If waived OR outside 14-day period
```

## Edge Function Integration

The `manage-subscription` edge function checks waiver status before processing refunds:

```typescript
// Checks if refund is available
const { data: refundAmount } = await supabase
  .rpc("calculate_platform_refund_amount", { user_id_param: user.id });

if (refundAmount === 0) {
  // Check if waived
  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_withdrawal_right_waived, platform_withdrawal_waiver_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.platform_withdrawal_right_waived) {
    return error: "You have used benefits from this subscription";
  }
}
```

## User Experience Flow

### Scenario 1: No Benefits Used
```
User subscribes → Within 14 days → Requests refund
→ ✅ Full refund granted
```

### Scenario 2: Benefits Used
```
User subscribes → Uses discount on purchase (Day 3)
→ Waiver flag set automatically
→ Requests refund (Day 5)
→ ❌ Refund denied (waiver message shown)
```

### Scenario 3: After 14 Days
```
User subscribes → 15 days pass → Requests refund
→ ❌ Refund denied (outside withdrawal period)
```

## UI Integration

### Cancellation Modal

The `CancellationModal` component shows different messages based on waiver status:

**If within 14 days AND not waived:**
- Green success box
- Checkbox to request refund
- "14-Day Withdrawal Period" header

**If waived:**
- Red warning box
- Explanation of which benefit was used
- Reference to EU law
- No refund checkbox

**If outside 14 days:**
- Yellow info box
- Standard cancellation message
- No refund option

### Account Page

The Account page passes waiver status to the modal:

```typescript
withdrawalRightWaived={
  cancelTarget?.type === 'platform'
    ? getPlatformWithdrawalStatus().waived
    : getProfessorWithdrawalStatus(subscriptionId).waived
}

withdrawalWaiverReason={
  cancelTarget?.type === 'platform'
    ? getPlatformWithdrawalStatus().reason
    : getProfessorWithdrawalStatus(subscriptionId).reason
}
```

## Testing Scenarios

### Test 1: Normal Refund
1. Subscribe to platform
2. Wait 1 day
3. Don't use any benefits
4. Request refund
5. ✅ Should receive full refund

### Test 2: Waiver on Program Purchase
1. Subscribe to platform
2. Wait 1 day
3. Purchase a program with subscriber discount
4. Check database: `platform_withdrawal_right_waived` should be `true`
5. Try to request refund
6. ❌ Should be denied with waiver message

### Test 3: Waiver on Video Purchase
1. Subscribe to professor
2. Wait 1 day
3. Purchase a video with professor discount
4. Check database: `withdrawal_right_waived` should be `true`
5. Try to request refund
6. ❌ Should be denied

### Test 4: After 14 Days
1. Subscribe to platform
2. Wait 15 days
3. Don't use any benefits
4. Try to request refund
5. ❌ Should be denied (outside period)

## Database Queries for Monitoring

### Check waiver statistics
```sql
SELECT
  COUNT(*) as total_subscriptions,
  SUM(CASE WHEN platform_withdrawal_right_waived THEN 1 ELSE 0 END) as waived_count,
  platform_withdrawal_waiver_reason,
  COUNT(*) as reason_count
FROM profiles
WHERE platform_subscription_created_at IS NOT NULL
GROUP BY platform_withdrawal_waiver_reason;
```

### Find users who waived their rights
```sql
SELECT
  id,
  email,
  platform_subscription_created_at,
  platform_withdrawal_waived_at,
  platform_withdrawal_waiver_reason
FROM profiles
WHERE platform_withdrawal_right_waived = true
ORDER BY platform_withdrawal_waived_at DESC;
```

### Audit trail of purchases that triggered waivers
```sql
SELECT
  pp.user_id,
  pp.purchased_at,
  pp.price_paid,
  p.price as full_price,
  (p.price - pp.price_paid) as discount_amount,
  prof.platform_withdrawal_waiver_reason
FROM program_purchases pp
JOIN programs p ON p.id = pp.program_id
JOIN profiles prof ON prof.id = pp.user_id
WHERE prof.platform_withdrawal_right_waived = true
  AND pp.purchased_at >= prof.platform_subscription_created_at
  AND pp.purchased_at <= prof.platform_subscription_created_at + interval '14 days';
```

## Compliance Notes

1. **Transparent Communication**: Users are informed about the waiver in:
   - Terms & Conditions
   - Refund Policy
   - Cancellation modal (when waived)

2. **Automatic Enforcement**: No manual intervention needed
   - Triggers fire automatically on purchase
   - Edge function checks waiver status
   - UI reflects waiver state

3. **Audit Trail**: Complete tracking of:
   - When waiver occurred
   - Why it was waived
   - What triggered it

4. **Fair Application**:
   - Only applies when benefits are actually used
   - Full refund still available if no benefits used
   - Clear explanation when denied

## Security Considerations

1. **Server-Side Enforcement**: All checks happen in database/edge functions
2. **No Client-Side Bypass**: UI is informational only
3. **Immutable Once Set**: Waiver flag cannot be unset
4. **Tamper-Proof**: Triggers fire at database level

## Future Enhancements

Potential improvements:
- Email notification when waiver occurs
- Dashboard for admins to view waiver statistics
- Refund request history with waiver reasons
- A/B testing different waiver thresholds
- Warning before using discount if within withdrawal period
