export function makeCopy(product) {
  const colors = product.colors.trim() || '상품 사진 참고';
  const material = product.material?.trim() ? `입력된 소재 정보는 ${product.material}입니다.\n` : '';
  return `일상에 자연스럽게 스며드는 ${product.name}.\n${material}${colors} 컬러로 나만의 데일리 룩을 완성해 보세요.`;
}
export function priceLabel(price) {
  return `${new Intl.NumberFormat('ko-KR').format(Number(price))}원`;
}
export function safeFilename(name) {
  return (name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || '상품') + '_상세페이지';
}
