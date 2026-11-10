-- Synthetic menu rows for local and demo environments; safe to apply repeatedly.
insert into public.menu_items (id, name, description, price, prep_minutes, is_available)
values
  ('10000000-0000-4000-8000-000000000001', 'Aloo Samosa', 'Crisp potato pastry with mint chutney.', 50, 2, true),
  ('10000000-0000-4000-8000-000000000002', 'Chicken Roll', 'Spiced chicken wrapped in a warm paratha.', 190, 5, true),
  ('10000000-0000-4000-8000-000000000003', 'Masala Fries', 'Golden fries tossed with house masala.', 160, 5, true),
  ('10000000-0000-4000-8000-000000000004', 'Chicken Biryani', 'Aromatic rice with chicken and raita.', 280, 8, true),
  ('10000000-0000-4000-8000-000000000005', 'Doodh Patti Chai', 'Strong milk tea brewed to order.', 70, 3, true),
  ('10000000-0000-4000-8000-000000000006', 'Mint Lemonade', 'Fresh lemon, mint, and chilled water.', 110, 2, true),
  ('10000000-0000-4000-8000-000000000007', 'Veggie Sandwich', 'Toasted bread with crisp vegetables.', 150, 4, true),
  ('10000000-0000-4000-8000-000000000008', 'Chocolate Brownie', 'Soft cocoa brownie baked in small batches.', 130, 3, true),
  ('10000000-0000-4000-8000-000000000009', 'Chicken Cheese Paratha', 'Flaky paratha with chicken and melted cheese.', 240, 7, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  prep_minutes = excluded.prep_minutes,
  is_available = excluded.is_available;
