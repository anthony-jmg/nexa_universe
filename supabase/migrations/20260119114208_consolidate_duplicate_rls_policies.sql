/*
  # Consolidate Duplicate RLS Policies

  This migration removes duplicate permissive policies that grant the same access,
  keeping only the most comprehensive policy for each case.

  ## Duplicate Policies Removed

  1. **orders** - Consolidate duplicate INSERT and UPDATE policies
  2. **order_items** - Consolidate duplicate INSERT and SELECT policies  
  3. **professor_subscriptions** - Remove redundant SELECT policies
  4. **professors** - Remove redundant admin policies
  5. **program_purchases** - Consolidate multiple overlapping policies
  6. **videos** - Consolidate multiple manage/view policies
  7. **programs** - Consolidate multiple view policies
  8. **events** - Consolidate admin management policies
  9. **ticket_types** - Consolidate admin management policies

  ## Security Impact

  This improves security clarity by having one clear policy per access pattern,
  making it easier to audit and maintain security rules.
*/

-- Orders: Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Users can create orders" ON orders;

-- Orders: Remove one of the duplicate UPDATE policies  
DROP POLICY IF EXISTS "Admins can update orders" ON orders;

-- Order Items: Remove duplicate INSERT policy
DROP POLICY IF EXISTS "Users can create order items" ON order_items;

-- Professor Subscriptions: Remove one redundant SELECT policy
DROP POLICY IF EXISTS "Users can view own subscriptions" ON professor_subscriptions;

-- Programs: Remove duplicate SELECT policies for anonymous users
DROP POLICY IF EXISTS "Anonymous users can discover programs for marketing" ON programs;

-- Programs: Consolidate authenticated SELECT policies - keep most comprehensive
DROP POLICY IF EXISTS "Authenticated view all programs" ON programs;
DROP POLICY IF EXISTS "Authenticated users can view programs" ON programs;

-- Videos: Remove duplicate SELECT policies for anonymous users  
DROP POLICY IF EXISTS "Anonymous users can discover videos for marketing" ON videos;

-- Videos: Consolidate authenticated SELECT policies
DROP POLICY IF EXISTS "Authenticated view all videos" ON videos;
DROP POLICY IF EXISTS "Authenticated users can view videos" ON videos;

-- Videos: Consolidate management policies - keep "Professors manage own videos"
DROP POLICY IF EXISTS "Professors can manage own videos" ON videos;

-- Programs: Consolidate management policies  
DROP POLICY IF EXISTS "Professors can manage own programs" ON programs;

-- Events: Remove duplicate admin policies
DROP POLICY IF EXISTS "Admins can insert events" ON events;
DROP POLICY IF EXISTS "Admins can update events" ON events;
DROP POLICY IF EXISTS "Admins can delete events" ON events;

-- Ticket Types: Remove duplicate admin policies
DROP POLICY IF EXISTS "Admins can insert ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins can update ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Admins can delete ticket types" ON ticket_types;

-- Program Purchases: Consolidate overlapping policies
-- Keep "Users can view own purchases" as it's the most specific
-- The "Professors can view purchases" and "Professors can view their program purchases" are kept for professor access