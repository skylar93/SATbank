"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ScoringCurve {
  id: number
  curve_name: string
}

interface CurveSelectorProps {
  curves: ScoringCurve[]
  currentCurveId: number | null
  onCurveChange: (newCurveId: number) => void
  placeholder?: string
}

export function CurveSelector({
  curves,
  currentCurveId,
  onCurveChange,
  placeholder = "Select a scoring curve"
}: CurveSelectorProps) {
  return (
    <Select
      value={currentCurveId?.toString() || ""}
      onValueChange={(value) => onCurveChange(parseInt(value))}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {curves.map((curve) => (
          <SelectItem key={curve.id} value={curve.id.toString()}>
            {curve.curve_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}