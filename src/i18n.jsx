// Trang chỉ dùng tiếng Anh. Hàm t() nhận { en } hoặc chuỗi thường.
export function useT() {
  return (value) => (typeof value === 'string' ? value : value?.en)
}
