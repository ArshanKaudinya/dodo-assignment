import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-green-700">Payment Successful</h1>
        <p className="text-gray-600">
          Your subscription is now active.
        </p>

        <div className="pt-2 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
          >
            Go to Account
          </Link>
        </div>
      </div>
    </main>
  );
}
