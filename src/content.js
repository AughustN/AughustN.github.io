// Toàn bộ nội dung web nằm ở đây. Sửa file này là đủ, không cần đụng component.
// Mỗi chuỗi song ngữ có dạng { en: '...', vi: '...' }.

export const profile = {
  name: 'Your Name',
  role: { en: 'Data Science Student', vi: 'Sinh viên Khoa học Dữ liệu' },
  location: { en: 'Ho Chi Minh City, Vietnam', vi: 'TP. Hồ Chí Minh, Việt Nam' },
  intro: {
    en: 'I build data-driven tools and study machine learning. Currently looking for internship opportunities.',
    vi: 'Mình xây dựng các công cụ dựa trên dữ liệu và nghiên cứu học máy. Hiện đang tìm cơ hội thực tập.',
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
  vi: [
    'Viết hai, ba đoạn ngắn giới thiệu bản thân: bạn học gì, quan tâm bài toán nào, muốn làm gì tiếp theo.',
    'Viết cụ thể. Nêu chủ đề, công cụ hoặc kết quả thay vì tính từ.',
  ],
}

export const projects = [
  {
    title: 'Project One',
    year: '2026',
    description: {
      en: 'One or two sentences on what the project does and what you contributed.',
      vi: 'Một, hai câu mô tả dự án làm gì và bạn đóng góp phần nào.',
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
      vi: 'Mô tả bài toán, cách tiếp cận và một kết quả đo được nếu có.',
    },
    tags: ['SQL', 'Pandas', 'Streamlit'],
    links: [{ label: 'Code', href: 'https://github.com/AughustN/project-two' }],
  },
]

export const experience = [
  {
    period: '2025 – 2026',
    title: { en: 'Research Assistant', vi: 'Trợ lý nghiên cứu' },
    org: { en: 'Lab / Company name', vi: 'Tên lab / công ty' },
    description: {
      en: 'What you did and what came out of it.',
      vi: 'Bạn đã làm gì và kết quả ra sao.',
    },
  },
]

export const education = [
  {
    period: '2023 – 2027',
    title: { en: 'B.Sc. in Data Science', vi: 'Cử nhân Khoa học Dữ liệu' },
    org: { en: 'University name', vi: 'Tên trường' },
    description: { en: 'GPA, relevant coursework, awards.', vi: 'GPA, môn học liên quan, giải thưởng.' },
  },
]

export const skills = [
  { group: { en: 'Languages', vi: 'Ngôn ngữ' }, items: ['Python', 'SQL', 'JavaScript'] },
  { group: { en: 'ML / Data', vi: 'ML / Dữ liệu' }, items: ['PyTorch', 'scikit-learn', 'Pandas'] },
  { group: { en: 'Tools', vi: 'Công cụ' }, items: ['Git', 'Docker', 'Linux'] },
]

// Nhãn giao diện
export const ui = {
  about: { en: 'About', vi: 'Giới thiệu' },
  projects: { en: 'Projects', vi: 'Dự án' },
  experience: { en: 'Experience', vi: 'Kinh nghiệm' },
  education: { en: 'Education', vi: 'Học vấn' },
  skills: { en: 'Skills', vi: 'Kỹ năng' },
  footer: { en: 'Built with React + Vite.', vi: 'Xây dựng bằng React + Vite.' },
}
