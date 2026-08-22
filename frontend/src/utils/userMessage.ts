/** 将接口/系统原始错误转成用户能看懂的中文提示。 */
export function toUserMessage(err: unknown, fallback = '操作失败，请稍后重试'): string {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : fallback;
  return sanitizeUserMessage(raw, fallback);
}

export function sanitizeUserMessage(raw: string, fallback = '操作失败，请稍后重试'): string {
  const msg = (raw || '').trim();
  if (!msg) return fallback;
  const lower = msg.toLowerCase();

  if (/idx_account_email|duplicate key[\s\S]*email|unique constraint[\s\S]*email/i.test(msg)) {
    return '该邮箱已被使用，请换一个邮箱';
  }
  if (/idx_account_username|duplicate key[\s\S]*username|unique constraint[\s\S]*username/i.test(msg)) {
    return '该用户名已被使用，请换一个用户名';
  }
  if (/duplicate key|unique constraint|sqlstate\s*23505/i.test(msg)) {
    return '数据与已有记录冲突，请检查是否填写重复';
  }
  if (/sqlstate|pq:|^error:|goroutine|econnrefused|etimedout|enotfound/i.test(msg)) {
    return '操作失败，请稍后重试；若反复出现请联系管理员';
  }
  if (/failed to fetch|networkerror|load failed|net::/i.test(msg)) {
    return '无法连接服务器，请确认网络或后端服务是否正常';
  }
  if (/^http\s*\d+/i.test(msg) || lower.startsWith('http ')) {
    return '请求失败，请稍后重试';
  }
  if (/field validation for 'email'/i.test(msg)) {
    return /required/i.test(msg) ? '请填写邮箱' : '邮箱格式不正确';
  }
  if (/field validation for 'username'/i.test(msg)) {
    return '请填写用户名';
  }
  if (/field validation for 'password'/i.test(msg)) {
    return /min/i.test(msg) ? '密码至少 6 位' : '请填写密码';
  }

  // 明显技术英文、几乎无中文
  if (!/[\u4e00-\u9fff]/.test(msg) && /(failed|error|exception|undefined|null)/i.test(msg)) {
    return fallback;
  }

  return msg;
}
