// 관리자 페이지에서 Multiple Answers 입력을 위한 컴포넌트 예시

import { useState } from 'react';

interface MultipleAnswersInputProps {
  value: string[];
  onChange: (answers: string[]) => void;
  label?: string;
}

export function MultipleAnswersInput({ value, onChange, label = "정답들" }: MultipleAnswersInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addAnswer = () => {
    if (inputValue.trim() && !value.includes(inputValue.trim())) {
      onChange([...value, inputValue.trim()]);
      setInputValue('');
    }
  };

  const removeAnswer = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAnswer();
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {label} ({value.length}개)
      </label>
      
      {/* 현재 정답들 표시 */}
      <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border border-gray-200 rounded-md bg-gray-50">
        {value.length === 0 ? (
          <span className="text-gray-400 text-sm">정답을 추가하세요</span>
        ) : (
          value.map((answer, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-md"
            >
              "{answer}"
              <button
                type="button"
                onClick={() => removeAnswer(index)}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* 새 정답 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="새 정답 입력 (예: 0.75, 3/4)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addAnswer}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          추가
        </button>
      </div>

      {/* 도움말 텍스트 */}
      <div className="text-xs text-gray-500">
        💡 팁: 수학적으로 동등한 값들을 모두 입력하세요 (예: 3/4, 0.75, 6/8)
      </div>
    </div>
  );
}

// 사용 예시 - 질문 생성 폼에서
export function CreateGridInQuestionForm() {
  const [formData, setFormData] = useState({
    content: '',
    correctAnswers: [] as string[],
    difficulty_level: 'medium',
    explanation: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Supabase에 저장
    const questionData = {
      exam_id: 1, // 현재 선택된 시험 ID
      module_type: 'math_calculator',
      question_number: 25, // 자동 생성 또는 입력받은 값
      question_type: 'grid_in' as const,
      content: formData.content,
      correct_answers: formData.correctAnswers, // text[] 타입으로 저장됨
      difficulty_level: formData.difficulty_level,
      explanation: formData.explanation,
      points: 1
    };

    try {
      const { data, error } = await supabase
        .from('questions')
        .insert(questionData);

      if (error) throw error;
      
      alert('Grid-in 문제가 성공적으로 생성되었습니다!');
      // 폼 초기화 등...
    } catch (error) {
      console.error('Error creating question:', error);
      alert('문제 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900">Grid-in 문제 생성</h2>
      
      {/* 문제 내용 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          문제 내용
        </label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: What is 3/4 as a decimal?"
          required
        />
      </div>

      {/* 정답들 입력 */}
      <MultipleAnswersInput
        value={formData.correctAnswers}
        onChange={(answers) => setFormData(prev => ({ ...prev, correctAnswers: answers }))}
        label="정답들 (수학적으로 동등한 모든 값)"
      />

      {/* 난이도 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          난이도
        </label>
        <select
          value={formData.difficulty_level}
          onChange={(e) => setFormData(prev => ({ ...prev, difficulty_level: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      {/* 해설 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          해설 (선택사항)
        </label>
        <textarea
          value={formData.explanation}
          onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="예: 3을 4로 나누면 0.75가 됩니다."
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
        disabled={formData.correctAnswers.length === 0}
      >
        Grid-in 문제 생성
      </button>
    </form>
  );
}