/**
 * 高危操作二次确认
 */
export function confirmDanger(modal, { title, content, okText = '确定删除' }) {
  return new Promise((resolve) => {
    modal.confirm({
      title,
      content,
      okText,
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      getContainer: () => document.body,
      zIndex: 2000,
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

export function confirmWarning(modal, { title, content, okText = '确定' }) {
  return new Promise((resolve) => {
    modal.confirm({
      title,
      content,
      okText,
      cancelText: '取消',
      okType: 'primary',
      centered: true,
      getContainer: () => document.body,
      zIndex: 2000,
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}
