// Toàn bộ nội dung web nằm ở đây. Sửa file này là đủ, không cần đụng component.

export const profile = {
  name: 'AughustK',
  role: { en: 'Data Science Student' },
  location: { en: 'Ho Chi Minh City, Vietnam' },
  // Các dòng tiêu đề đổi luân phiên ở đầu trang.
  headlines: [
    { en: 'Computer Vision' },
    { en: 'Healthcare AI' },
    { en: 'Cognitive Science' },
  ],
  intro: {
    en: 'I build data-driven tools and study machine learning. Currently looking for internship opportunities.',
  },
  links: [
    { label: 'GitHub', href: 'https://github.com/AughustN' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-username' },
    { label: 'Email', href: 'mailto:you@example.com' },
    { label: 'CV', href: '/cv.pdf' },
  ],
}

export const about = {
  en: [
    'Write two or three short paragraphs about yourself here: what you study, what problems interest you, and what you want to work on next.',
    'Keep it concrete. Mention specific topics, tools or results instead of adjectives.',
  ],
}

export const projects = [
  {
    title: 'Project One',
    year: '2026',
    description: {
      en: 'One or two sentences on what the project does and what you contributed.',
    },
    tags: ['Python', 'PyTorch'],
    links: [
      { label: 'Code', href: 'https://github.com/AughustN/project-one' },
      { label: 'Demo', href: '#' },
    ],
  },
  {
    title: 'Project Two',
    year: '2025',
    description: {
      en: 'Describe the problem, your approach, and a measurable result if you have one.',
    },
    tags: ['SQL', 'Pandas', 'Streamlit'],
    links: [{ label: 'Code', href: 'https://github.com/AughustN/project-two' }],
  },
]

export const publications = [
  {
    title: 'Paper Title',
    year: '2026',
    venue: { en: 'Conference or journal name' },
    description: {
      en: 'One sentence on the question the paper answers and your contribution.',
    },
    href: '#',
  },
]

export const posts = [
  {
    title: { en: 'Post Title' },
    date: '2026-01-01',
    description: {
      en: 'One sentence on what the reader will take away.',
    },
    href: '#',
  },
]

export const experience = [
  {
    period: '2025 – 2026',
    title: { en: 'Research Assistant' },
    org: { en: 'Lab / Company name' },
    description: {
      en: 'What you did and what came out of it.',
    },
  },
]

export const education = [
  {
    period: '2023 – 2027',
    title: { en: 'B.Sc. in Data Science' },
    org: { en: 'University name' },
    description: { en: 'GPA, relevant coursework, awards.' },
  },
]

export const skills = [
  { group: { en: 'Languages' }, items: ['Python', 'SQL', 'JavaScript'] },
  { group: { en: 'ML / Data' }, items: ['PyTorch', 'scikit-learn', 'Pandas'] },
  { group: { en: 'Tools' }, items: ['Git', 'Docker', 'Linux'] },
]

// Thanh điều hướng. `id` phải trùng id của section trong App.jsx.
export const navItems = [
  { id: 'home', label: { en: 'Home' } },
  { id: 'work', label: { en: 'Work' } },
  { id: 'publication', label: { en: 'Publication' } },
  { id: 'about', label: { en: 'About' } },
  { id: 'blog', label: { en: 'Blog' } },
]

// Nhãn giao diện
export const ui = {
  contact: { en: 'Contact' },
  loading: { en: 'Loading' },
  toggleTheme: { en: 'Switch light or dark theme' },
  publication: { en: 'Publication' },
  blog: { en: 'Blog' },
  about: { en: 'About' },
  projects: { en: 'Projects' },
  experience: { en: 'Experience' },
  education: { en: 'Education' },
  skills: { en: 'Skills' },
  footer: { en: 'Built with React + Vite.' },
  state: { en: 'State' },
  stateValue: { en: 'Undergraduate' },
  feeling: { en: 'Feeling' },
  feelings: {
    happy: { en: 'Happy' },
    surprised: { en: 'Surprised' },
    annoyed: { en: 'Annoyed' },
  },
}
