import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-black dark:to-zinc-900">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-8 py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50 sm:text-7xl">
            Dpay
          </h1>
          <p className="max-w-md text-xl leading-8 text-zinc-600 dark:text-zinc-400">
            Decentralized payment solution for the modern web
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/register"
              className="flex h-12 w-full items-center justify-center rounded-full bg-black px-8 text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:w-auto"
            >
              Create Room
            </Link>
            <Link
              href="/join"
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black px-8 transition-colors hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black sm:w-auto"
            >
              Join Room
            </Link>
            <Link
              href="/rooms"
              className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black px-8 transition-colors hover:bg-black hover:text-white dark:border-white dark:hover:bg-white dark:hover:text-black sm:w-auto"
            >
              My Rooms
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
