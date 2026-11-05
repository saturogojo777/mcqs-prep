import { IconBolt, IconBook, IconExam, IconGrid, IconShield, IconSubject } from '@/components/icons'

const MAP: Record<string, (props: { size?: number }) => React.ReactElement> = {
  ppsc: IconExam,
  fpsc: IconExam,
  spsc: IconExam,
  'nts-pts-ots': IconGrid,
  'css-pms': IconSubject,
  'mdcat-ecat': IconBolt,
  forces: IconShield,
  police: IconShield,
  teachers: IconBook,
}

/** One line glyph per exam, falling back to the generic exam sheet. */
export default function ExamIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const Icon = MAP[slug] ?? IconExam
  return <Icon size={size} />
}
