export function makeCopy(product) {
  const colors = product.colors.trim() || '상품 사진 참고';
  return `일상에 자연스럽게 스며드는 ${product.name}.\n${product.material} 소재의 매력을 담아 나만의 스타일을 완성해 보세요.\n${colors} 컬러로 다양한 데일리 룩에 함께하기 좋은 아이템입니다.`;
}
export function priceLabel(price) {
  return `${new Intl.NumberFormat('ko-KR').format(Number(price))}원`;
}
export function safeFilename(name) {
  return (name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || '상품') + '_상세페이지';
}
