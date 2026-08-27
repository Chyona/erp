import { useCallback, useEffect, useState } from 'react';

export const INVOICE_RECOGNIZE_ON_UPLOAD_KEY = 'erp_invoice_recognize_on_upload';

const INVOICE_RECOGNIZE_CHANGE_EVENT = 'erp-invoice-recognize-change';

export function readInvoiceRecognizeOnUpload(): boolean {
  return localStorage.getItem(INVOICE_RECOGNIZE_ON_UPLOAD_KEY) === '1';
}

function writeInvoiceRecognizeOnUpload(checked: boolean) {
  localStorage.setItem(INVOICE_RECOGNIZE_ON_UPLOAD_KEY, checked ? '1' : '0');
  window.dispatchEvent(
    new CustomEvent(INVOICE_RECOGNIZE_CHANGE_EVENT, { detail: checked })
  );
}

export function useInvoiceRecognizeOnUpload() {
  const [enabled, setEnabledState] = useState(readInvoiceRecognizeOnUpload);

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<boolean>).detail;
      if (typeof next === 'boolean') {
        setEnabledState(next);
        return;
      }
      setEnabledState(readInvoiceRecognizeOnUpload());
    };

    window.addEventListener(INVOICE_RECOGNIZE_CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(INVOICE_RECOGNIZE_CHANGE_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setEnabled = useCallback((checked: boolean) => {
    setEnabledState(checked);
    writeInvoiceRecognizeOnUpload(checked);
  }, []);

  return { enabled, setEnabled };
}
