'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/auth-context'
import BackgroundPaths from '../components/kokonutui/background-paths'
import { Button } from '../components/ui/button'

export default function Home() {
  const { user, loading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      if (isAdmin) {
        window.location.href = '/admin/dashboard'
      } else {
        window.location.href = '/student/dashboard'
      }
    }
  }, [user, loading, isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-white dark:bg-neutral-950">
      <div className="absolute inset-0">
        <div className="absolute inset-0 pointer-events-none">
          <svg className="w-full h-full text-slate-950 dark:text-white" viewBox="0 0 696 316" fill="none">
            <title>Background Paths</title>
            {Array.from({ length: 36 }, (_, i) => ({
              id: i,
              d: `M-${380 - i * 5} -${189 + i * 6}C-${380 - i * 5} -${189 + i * 6} -${312 - i * 5} ${216 - i * 6} ${152 - i * 5} ${343 - i * 6}C${616 - i * 5} ${470 - i * 6} ${684 - i * 5} ${875 - i * 6} ${684 - i * 5} ${875 - i * 6}`,
              width: 0.5 + i * 0.03,
            })).map((path) => (
              <motion.path
                key={path.id}
                d={path.d}
                stroke="currentColor"
                strokeWidth={path.width}
                strokeOpacity={0.1 + path.id * 0.03}
                initial={{ pathLength: 0.3, opacity: 0.6 }}
                animate={{
                  pathLength: 1,
                  opacity: [0.3, 0.6, 0.3],
                  pathOffset: [0, 1, 0],
                }}
                transition={{
                  duration: 20 + Math.random() * 10,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              />
            ))}
          </svg>
        </div>
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter">
            {"SAT Excellence".split(" ").map((word, wordIndex) => (
              <span key={wordIndex} className="inline-block mr-4 last:mr-0">
                {word.split("").map((letter, letterIndex) => (
                  <motion.span
                    key={`${wordIndex}-${letterIndex}`}
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      delay: wordIndex * 0.1 + letterIndex * 0.03,
                      type: "spring",
                      stiffness: 150,
                      damping: 25,
                    }}
                    className="inline-block text-transparent bg-clip-text 
                                        bg-gradient-to-r from-neutral-900 to-neutral-700/80 
                                        dark:from-white dark:to-white/80"
                  >
                    {letter}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto"
          >
            Master the SAT with full-length mock exams, targeted practice questions, 
            and detailed performance analytics designed for success.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="flex justify-center mb-12"
          >
            <div
              className="inline-block group relative bg-gradient-to-b from-blue-500/10 to-blue-600/10 
                          p-px rounded-2xl backdrop-blur-lg overflow-hidden shadow-lg hover:shadow-xl 
                          transition-shadow duration-300"
            >
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="rounded-[1.15rem] px-8 py-6 text-lg font-semibold backdrop-blur-md 
                              bg-blue-50/95 hover:bg-blue-50/100 dark:bg-blue-900/95 dark:hover:bg-blue-900/100 
                              text-blue-700 dark:text-blue-300 transition-all duration-300 
                              group-hover:-translate-y-0.5 border border-blue-200/50 dark:border-blue-700/50
                              hover:shadow-md dark:hover:shadow-blue-800/30"
                >
                  <span className="opacity-90 group-hover:opacity-100 transition-opacity">Sign In</span>
                </Button>
              </Link>
            </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}