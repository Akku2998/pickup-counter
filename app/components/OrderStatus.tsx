"use client";

import { useEffect, useState } from "react";

// type OrderStatusProps = {
//   orderId: string;
// };
type OrderStatusProps = {
  orderId: string;
  onNewOrder: () => void;
};

type OrderDetails = {
  orderId: string;
  status: string;
  totalPaise: number;
  expiresInSeconds: number;
  expiresAt: string;
};

// export default function OrderStatus({ orderId }: OrderStatusProps) {
export default function OrderStatus({ orderId, onNewOrder }: OrderStatusProps) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  // Load order status from the backend.
  useEffect(() => {
    let active = true;

    async function fetchOrder() {
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to fetch order");
        }

        const data: OrderDetails = await response.json();

        if (!active) return;

        setOrder(data);

        if (data.status === "PENDING") {
          // Use server-provided remaining time.
          const newDeadline = performance.now() + data.expiresInSeconds * 1000;

          setDeadline(newDeadline);
          setSecondsLeft(data.expiresInSeconds);
        } else {
          setDeadline(null);
          setSecondsLeft(0);
        }

        setError("");
      } catch {
        if (active) {
          setError("Unable to check payment status");
        }
      }
    }

    fetchOrder();

    // Check backend every 2 seconds.
    const polling = setInterval(fetchOrder, 2000);

    return () => {
      active = false;
      clearInterval(polling);
    };
  }, [orderId]);

  // Update countdown without contacting the backend.
  useEffect(() => {
    if (deadline === null) return;

    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline - performance.now()) / 1000),
      );

      setSecondsLeft(remaining);
    }, 250);

    return () => clearInterval(timer);
  }, [deadline]);

  async function claimPickup() {
    if (!order || order.status !== "PAID") return;

    setClaiming(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/${orderId}/pickup-claim`, {
        method: "POST",
      });

      // Read the response as text first.
      const responseText = await response.text();

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Pickup API returned an invalid response (HTTP ${response.status}). Check the API route and server logs.`,
        );
      }

      if (!response.ok) {
        throw new Error(data.message ?? "Pickup failed");
      }

      setOrder((previous) =>
        previous ? { ...previous, status: "PICKED_UP" } : previous,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pickup failed");
    } finally {
      setClaiming(false);
    }
  }

  // async function claimPickup() {
  //   if (!order || order.status !== "PAID") return;

  //   setClaiming(true);
  //   setError("");

  //   try {
  //     const response = await fetch(`/api/orders/${orderId}/pickup-claim`, {
  //       method: "POST",
  //     });

  //     const data = await response.json();

  //     if (!response.ok) {
  //       throw new Error(data.message ?? "Pickup failed");
  //     }

  //     setOrder((previous) =>
  //       previous ? { ...previous, status: "PICKED_UP" } : previous,
  //     );
  //   } catch (error) {
  //     setError(error instanceof Error ? error.message : "Pickup failed");
  //   } finally {
  //     setClaiming(false);
  //   }
  // }

  if (!order) {
    return <p className="p-6">Loading order...</p>;
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-5 text-3xl font-bold">Your Order</h1>

      <div className="rounded-xl border p-5">
        <p className="mb-3 break-all text-sm text-gray-500">
          Order ID: {order.orderId}
        </p>

        <p className="mb-3 text-lg">
          Status: <strong>{order.status}</strong>
        </p>

        <p className="mb-4 text-xl font-bold">
          Total: ₹{(order.totalPaise / 100).toFixed(2)}
        </p>

        {order.status === "PENDING" && (
          <div className="rounded-lg bg-yellow-50 p-4 text-yellow-900">
            <p className="font-semibold">Complete payment within:</p>

            <p className="mt-2 text-3xl font-bold">
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </p>

            <p className="mt-3 text-sm">Waiting for payment confirmation...</p>
          </div>
        )}

        {order.status === "PAID" && (
          <div className="rounded-lg bg-green-50 p-4 text-green-900">
            <p className="mb-4 font-semibold">
              Payment successful! Your order is ready.
            </p>

            <button
              onClick={claimPickup}
              disabled={claiming}
              className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {claiming ? "Processing..." : "Collect Order"}
            </button>
          </div>
        )}

        {/* {order.status === "PICKED_UP" && (
          <p className="rounded-lg bg-green-50 p-4 text-green-900">
            Order collected successfully!
          </p>
        )} */}
        {order.status === "PICKED_UP" && (
          <div className="rounded-lg bg-green-50 p-4 text-green-900">
            <p className="font-semibold">Order collected successfully!</p>

            <button
              onClick={onNewOrder}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-white"
            >
              Create New Order
            </button>
          </div>
        )}
        {/* {order.status === "EXPIRED" && (
          <p className="rounded-lg bg-red-50 p-4 text-red-900">
            Your reservation has expired. Please create a new order.
          </p>
        )} */}
        {order.status === "EXPIRED" && (
          <div className="rounded-lg bg-red-50 p-4 text-red-900">
            <p>Your reservation has expired. Please create a new order.</p>

            <button
              onClick={onNewOrder}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-white"
            >
              Create New Order
            </button>
          </div>
        )}

        {order.status === "NEEDS_REVIEW" && (
          <p className="rounded-lg bg-orange-50 p-4 text-orange-900">
            Payment requires manual review. Please contact the counter staff.
          </p>
        )}

        {error && <p className="mt-4 text-red-600">{error}</p>}
      </div>
    </main>
  );
}
