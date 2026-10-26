-- Smart Restaurant initial menu data
-- Run only when the menu_items table is empty.

INSERT INTO menu_items (name, price, emoji, category, description)
SELECT 'Classic Burger', 250, '🍔', 'Burgers', 'Juicy classic burger.'
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

INSERT INTO menu_items (name, price, emoji, category, description)
SELECT 'Cheese Pizza', 450, '🍕', 'Pizza', 'Delicious cheese pizza.'
WHERE NOT EXISTS (SELECT 1 FROM menu_items);

INSERT INTO menu_items (name, price, emoji, category, description)
SELECT 'Creamy Pasta', 320, '🍝', 'Pasta', 'Rich and creamy pasta.'
WHERE NOT EXISTS (SELECT 1 FROM menu_items);
