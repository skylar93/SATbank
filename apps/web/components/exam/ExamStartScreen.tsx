'use client'

import {
  AcademicCapIcon,
  BookOpenIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface ExamStartScreenProps {
  exam: {
    id: string
    title: string
    description: string
  }
  modules: Array<{
    module: string
    questions: any[]
    timeLimit: number
  }>
  onStartExam: () => Promise<void>
}

export function ExamStartScreen({ exam, modules, onStartExam }: ExamStartScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AcademicCapIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {exam.title}
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {exam.description}
            </p>
          </div>

          <div className="mb-8">
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-6 mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                  <BookOpenIcon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-violet-800">
                  Exam Instructions
                </h3>
              </div>
              <ul className="space-y-3 text-violet-700">
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>
                    This exam consists of 4 modules: English 1, English 2,
                    Math 1, Math 2
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>Each module has a strict time limit</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>
                    You cannot return to previous questions or modules
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>
                    Answer all questions to the best of your ability
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="w-2 h-2 bg-violet-400 rounded-full mt-2 flex-shrink-0"></span>
                  <span>The exam will auto-submit when time expires</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {modules.map((module, index) => {
                const colors = [
                  'from-indigo-50 to-indigo-100 border-indigo-200',
                  'from-violet-50 to-violet-100 border-violet-200',
                  'from-purple-50 to-purple-100 border-purple-200',
                  'from-pink-50 to-pink-100 border-pink-200',
                ]
                const iconColors = [
                  'bg-indigo-500',
                  'bg-violet-500',
                  'bg-purple-500',
                  'bg-pink-500',
                ]
                const hoverColors = [
                  'hover:from-indigo-100 hover:to-indigo-200',
                  'hover:from-violet-100 hover:to-violet-200',
                  'hover:from-purple-100 hover:to-purple-200',
                  'hover:from-pink-100 hover:to-pink-200',
                ]

                return (
                  <div
                    key={module.module}
                    className={`bg-gradient-to-r ${colors[index]} border ${hoverColors[index]} p-6 rounded-2xl text-center transition-all duration-200 hover:shadow-lg`}
                  >
                    <div
                      className={`w-12 h-12 ${iconColors[index]} rounded-xl flex items-center justify-center mx-auto mb-4`}
                    >
                      {module.module.includes('english') ? (
                        <BookOpenIcon className="w-6 h-6 text-white" />
                      ) : (
                        <AcademicCapIcon className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {module.module.replace(/(\d)/, ' $1').toUpperCase()}
                    </h4>
                    <p className="text-sm text-gray-600 mb-1">
                      {module.questions.length} questions
                    </p>
                    <p className="text-sm text-gray-600 flex items-center justify-center">
                      <ClockIcon className="w-4 h-4 mr-1" />
                      {module.timeLimit} minutes
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="text-center space-y-6">
            <button
              onClick={onStartExam}
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white px-12 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Start Exam
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}