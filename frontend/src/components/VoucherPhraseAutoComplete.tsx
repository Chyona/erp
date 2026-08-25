import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AutoComplete, Input } from 'antd';
import type { TextAreaProps } from 'antd/es/input';
import type { InputProps } from 'antd/es/input';
import { searchVoucherPhrases } from '../services/voucherPhraseCatalog';
import type { VoucherPhraseKind } from '../services/voucherPhrases';
import VoucherPhraseLibraryModal from './VoucherPhraseLibraryModal';

type VoucherPhraseAutoCompleteProps = {
  kind: VoucherPhraseKind;
  value?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onLibraryOpenChange?: (open: boolean) => void;
  onDropdownOpenChange?: (open: boolean) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  variant?: InputProps['variant'];
  className?: string;
};

export default function VoucherPhraseAutoComplete({
  kind,
  value,
  onChange,
  onFocus,
  onLibraryOpenChange,
  onDropdownOpenChange,
  placeholder,
  disabled,
  multiline = false,
  rows = 3,
  variant = 'outlined',
  className
}: VoucherPhraseAutoCompleteProps) {
  const [options, setOptions] = useState<Array<{ value: string }>>([]);
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dropdownOffsetY, setDropdownOffsetY] = useState(8);
  const requestIdRef = useRef(0);
  const anchorRef = useRef<HTMLDivElement>(null);

  const refreshOptions = useCallback(
    async (keyword: string) => {
      const requestId = ++requestIdRef.current;
      const list = await searchVoucherPhrases(kind, keyword);
      if (requestId !== requestIdRef.current) return;
      setOptions(list.map((text) => ({ value: text })));
    },
    [kind]
  );

  useEffect(() => {
    if (!open) return;
    void refreshOptions(value || '');
  }, [open, value, refreshOptions]);

  const handleSearch = (keyword: string) => {
    setOpen(true);
    void refreshOptions(keyword);
  };

  const handleFocus = () => {
    onFocus?.();
    setOpen(true);
    void refreshOptions(value || '');
  };

  const setLibraryOpenState = (next: boolean) => {
    setLibraryOpen(next);
    onLibraryOpenChange?.(next);
  };

  const openLibrary = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    setLibraryOpenState(true);
  };

  const libraryTrigger = disabled ? null : (
    <button
      type="button"
      className="voucher-phrase-input__library-trigger"
      aria-label={kind === 'summary' ? '打开摘要库' : '打开备注库'}
      onMouseDown={(event) => event.preventDefault()}
      onClick={openLibrary}
    >
      ···
    </button>
  );

  useEffect(() => {
    if (!open || multiline) return;
    const measure = () => {
      const height = anchorRef.current?.getBoundingClientRect().height ?? 0;
      setDropdownOffsetY(Math.max(Math.ceil(height) + 6, 8));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, multiline, value]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onDropdownOpenChange?.(next);
  };

  const summaryDropdownProps = multiline
    ? {}
    : {
        placement: 'bottomLeft' as const,
        builtinPlacements: {
          bottomLeft: {
            points: ['tl', 'tl'],
            offset: [0, dropdownOffsetY],
            overflow: {
              adjustX: true,
              adjustY: false,
              shiftY: false
            }
          }
        },
        classNames: {
          popup: {
            root: 'voucher-phrase-input__dropdown voucher-phrase-input__dropdown--sheet'
          }
        },
        styles: {
          popup: {
            root: {
              marginTop: 0,
              paddingTop: 0
            }
          }
        }
      };

  const sharedProps = {
    value: value ?? '',
    options,
    open,
    onOpenChange: handleOpenChange,
    onSearch: handleSearch,
    onChange,
    disabled,
    filterOption: false as const,
    defaultActiveFirstOption: false,
    popupMatchSelectWidth: multiline ? 520 : true,
    className: `voucher-phrase-input__ac ${className || ''}`.trim(),
    ...summaryDropdownProps
  };

  return (
    <>
      <div
        ref={anchorRef}
        className={`voucher-phrase-input${multiline ? ' voucher-phrase-input--multiline' : ''}`}
      >
        {multiline ? (
          <>
            <AutoComplete {...sharedProps}>
              <Input.TextArea
                rows={rows}
                placeholder={placeholder}
                variant={variant as TextAreaProps['variant']}
                onFocus={handleFocus}
              />
            </AutoComplete>
            {libraryTrigger}
          </>
        ) : (
          <AutoComplete {...sharedProps}>
            <Input
              variant={variant}
              placeholder={placeholder}
              suffix={libraryTrigger}
              onFocus={handleFocus}
            />
          </AutoComplete>
        )}
      </div>

      <VoucherPhraseLibraryModal
        open={libraryOpen}
        kind={kind}
        initialKeyword={value || ''}
        initialSelectedText={value || ''}
        onCancel={() => setLibraryOpenState(false)}
        onConfirm={(text) => {
          onChange?.(text);
          setLibraryOpenState(false);
        }}
      />
    </>
  );
}
