# Fix Stripe Price ID Error

## Problem
You're getting the error: `No such price: 'price_1Ss7q7Jk88J3QVko0v254cYY'`

This means the Price ID being used doesn't exist in your Stripe account.

## Current Configuration
Your `.env` file has these Price IDs:
- Monthly: `price_1Sng3cJKhzJmheLEpITuOXOP`
- Yearly: `price_1Sng43JKhzJmheLEluMc6SkF`

## Solution Steps

### Step 1: Verify Price IDs in Stripe Dashboard

1. Go to https://dashboard.stripe.com/test/products
2. Look for your platform subscription products
3. Click on each product to see its Price ID
4. Verify that the Price IDs match what's in your `.env` file

### Step 2: Create New Prices (if they don't exist)

If the Price IDs don't exist in Stripe, you need to create them:

1. Go to https://dashboard.stripe.com/test/products
2. Click "Add product"
3. Create a product named "NEXA Academy Monthly Subscription"
   - Set price to €8.99
   - Select "Recurring"
   - Billing period: Monthly
   - Click "Save product"
   - Copy the Price ID (starts with `price_`)

4. Click "Add product" again
5. Create a product named "NEXA Academy Yearly Subscription"
   - Set price to €89.00
   - Select "Recurring"
   - Billing period: Yearly
   - Click "Save product"
   - Copy the Price ID (starts with `price_`)

### Step 3: Update .env File

Update your `.env` file with the new Price IDs:

```bash
VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID=price_xxxxx  # Replace with actual ID
VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID=price_xxxxx   # Replace with actual ID
```

### Step 4: Clear Browser Cache and Restart Dev Server

1. Clear your browser cache (or open in incognito mode)
2. Stop the dev server (if running)
3. Restart: `npm run dev`
4. Try subscribing again

## Quick Check

Run this in your browser console to see what Price IDs are being used:

```javascript
console.log({
  monthly: import.meta.env.VITE_STRIPE_PLATFORM_MONTHLY_PRICE_ID,
  yearly: import.meta.env.VITE_STRIPE_PLATFORM_YEARLY_PRICE_ID
});
```

If these show `undefined`, your environment variables aren't loading correctly.

## Still Having Issues?

If the problem persists:
1. Make sure you've saved the `.env` file
2. Restart your dev server completely
3. Try in a new incognito window
4. Check that you're using TEST mode in Stripe (price IDs start with `price_` not `price_test_`)
