import Link from "next/link";

export default function Join() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="flex w-full max-w-2xl flex-col items-center justify-center px-8 py-16">
        <div className="w-full space-y-8">
          <div className="text-center">
            <Link
              href="/"
              className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50"
            >
              Dpay
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-3xl font-semibold text-black dark:text-zinc-50">
              Join
            </h2>
            <p className="mb-8 text-zinc-600 dark:text-zinc-400">
              Sign in to your Dpay account
            </p>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
                  placeholder="••••••••"
                />
              </div>
              <button className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Sign In
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-black underline dark:text-white"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

