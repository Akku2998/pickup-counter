"use client";

import { useEffect, useState } from "react";
import OrderStatus from "./OrderStatus";

type Product = {
  id: string;
  name: string;
  pricePaise: number;
  availableUnits: number;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type OrderResponse = {
  orderId: string;
  status: string;
  totalPaise: number;
  expiresInSeconds: number;
};

export default function PickupCounter() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResponse | null>(null);

  // Fetch products when the page opens.
  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");

        if (!response.ok) {
          throw new Error("Failed to load products");
        }

        const data = await response.json();
        setProducts(data);
      } catch {
        setError("Unable to load products");
      }
    }

    loadProducts();
  }, []);

  function addToCart(product: Product) {
    setCart((previous) => {
      const existing = previous.find((item) => item.productId === product.id);

      if (existing) {
        if (existing.quantity >= product.availableUnits) {
          return previous;
        }

        return previous.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      if (product.availableUnits <= 0) {
        return previous;
      }

      return [...previous, { productId: product.id, quantity: 1 }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((previous) =>
      previous
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  const totalPaise = cart.reduce((total, item) => {
    const product = products.find((product) => product.id === item.productId);

    return total + (product?.pricePaise ?? 0) * item.quantity;
  }, 0);

  async function placeOrder() {
    if (cart.length === 0) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: cart }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Failed to create order");
      }

      setOrder(data);
      setCart([]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // if (order) {
  //   return (
  //     <main className="mx-auto max-w-xl p-6">
  //       <h1 className="mb-4 text-2xl font-bold">Order Created!</h1>

  //       <p className="mb-2">Order ID: {order.orderId}</p>

  //       <p className="mb-2">Status: {order.status}</p>

  //       <p className="mb-2">Total: ₹{(order.totalPaise / 100).toFixed(2)}</p>

  //       <p className="mb-4">Payment time: {order.expiresInSeconds} seconds</p>

  //       <p className="text-sm text-gray-500">
  //         Payment simulation will be added next.
  //       </p>
  //     </main>
  //   );
  // }
  if (order) {
    return (
      <OrderStatus orderId={order.orderId} onNewOrder={() => setOrder(null)} />
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-3xl font-bold">Pickup Counter</h1>

      <p className="mb-8 text-gray-500">
        Choose your snacks and place an order.
      </p>

      {error && (
        <p className="mb-4 rounded bg-red-100 p-3 text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-xl border p-5">
            <h2 className="text-lg font-semibold">{product.name}</h2>

            <p className="mt-2 text-xl font-bold">
              ₹{(product.pricePaise / 100).toFixed(2)}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              {product.availableUnits} available
            </p>

            <button
              onClick={() => addToCart(product)}
              disabled={product.availableUnits === 0}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Add to Cart
            </button>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-xl border p-5">
        <h2 className="mb-4 text-xl font-bold">Your Cart</h2>

        {cart.length === 0 && (
          <p className="text-gray-500">Your cart is empty.</p>
        )}

        {cart.map((item) => {
          const product = products.find(
            (product) => product.id === item.productId,
          );

          if (!product) return null;

          return (
            <div
              key={item.productId}
              className="flex items-center justify-between border-b py-3"
            >
              <span>{product.name}</span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="rounded border px-3 py-1"
                >
                  -
                </button>

                <span>{item.quantity}</span>

                <button
                  onClick={() => addToCart(product)}
                  className="rounded border px-3 py-1"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        <div className="mt-5 flex justify-between text-xl font-bold">
          <span>Total</span>
          <span>₹{(totalPaise / 100).toFixed(2)}</span>
        </div>

        <button
          onClick={placeOrder}
          disabled={loading || cart.length === 0}
          className="mt-5 w-full rounded-lg bg-green-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Placing Order..." : "Place Order"}
        </button>
      </section>
    </main>
  );
}
