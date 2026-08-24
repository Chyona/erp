import { useEffect, useMemo, useState } from 'react';
import { Input, Tree } from 'antd';
import {
  DoubleLeftOutlined,
  DoubleRightOutlined,
  FileTextOutlined,
  FolderFilled,
  FolderOpenFilled,
  SearchOutlined
} from '@ant-design/icons';
import type { Account } from '../types';
import type { AntTreeNodeProps } from 'antd/es/tree';
import EllipsisText from './EllipsisText';
import {
  buildAccountTree,
  collectAccountTreeKeys,
  filterAccountTree,
  normalizeAccountTree,
  type AccountTreeNode
} from '../utils/accountTree';

function renderAccountTreeTitle(node: AccountTreeNode) {
  const label = `${node.account.code} ${node.account.name}`;
  return (
    <EllipsisText className="ant-tree-title" tooltip={label}>
      {label}
    </EllipsisText>
  );
}

type LedgerAccountTreeProps = {
  accounts: Account[];
  selectedId: string;
  onSelect: (accountId: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

function renderAccountTreeIcon({
  expanded,
  hasChildren
}: {
  expanded?: boolean;
  hasChildren: boolean;
}) {
  if (!hasChildren) {
    return (
      <span className="ledger-account-tree__icon ledger-account-tree__icon--leaf" aria-hidden>
        <FileTextOutlined />
      </span>
    );
  }

  return (
    <span
      className={`ledger-account-tree__icon ledger-account-tree__icon--folder${expanded ? ' ledger-account-tree__icon--open' : ''}`}
      aria-hidden
    >
      {expanded ? <FolderOpenFilled /> : <FolderFilled />}
    </span>
  );
}

function renderTreeNodeIcon(nodeProps: AntTreeNodeProps) {
  const node = nodeProps.data as AccountTreeNode | undefined;
  const hasChildren = Boolean(node?.children?.length);
  return renderAccountTreeIcon({ expanded: nodeProps.expanded, hasChildren });
}

export default function LedgerAccountTree({
  accounts,
  selectedId,
  onSelect,
  collapsed,
  onCollapsedChange
}: LedgerAccountTreeProps) {
  const [keyword, setKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const rawTree = useMemo(() => buildAccountTree(accounts), [accounts]);
  const filteredTree = useMemo(
    () => normalizeAccountTree(filterAccountTree(rawTree, keyword)),
    [rawTree, keyword]
  );

  useEffect(() => {
    if (keyword.trim()) {
      setExpandedKeys(collectAccountTreeKeys(filteredTree));
      return;
    }
    if (!selectedId) return;
    const visit = (nodes: AccountTreeNode[], path: string[] = []): string[] | null => {
      for (const node of nodes) {
        const nextPath = [...path, String(node.key)];
        if (node.key === selectedId) return path;
        if (node.children?.length) {
          const found = visit(node.children, nextPath);
          if (found) return found;
        }
      }
      return null;
    };
    const parents = visit(rawTree);
    if (parents?.length) setExpandedKeys(parents);
  }, [keyword, filteredTree, rawTree, selectedId]);

  if (collapsed) {
    return (
      <aside className="ledger-page__aside ledger-page__aside--collapsed">
        <button
          type="button"
          className="ledger-page__aside-toggle"
          aria-label="展开科目树"
          onClick={() => onCollapsedChange(false)}
        >
          <DoubleLeftOutlined />
        </button>
      </aside>
    );
  }

  return (
    <aside className="ledger-page__aside">
      <div className="ledger-page__aside-head">
        <span className="ledger-page__aside-title">快速切换</span>
        <button
          type="button"
          className="ledger-page__aside-toggle"
          aria-label="收起科目树"
          onClick={() => onCollapsedChange(true)}
        >
          <DoubleRightOutlined />
        </button>
      </div>
      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="搜索科目"
        value={keyword}
        className="ledger-page__aside-search"
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="ledger-page__aside-tree">
        <Tree
          blockNode
          showIcon
          className="ledger-page__account-tree"
          treeData={filteredTree}
          icon={renderTreeNodeIcon}
          titleRender={(nodeData) => renderAccountTreeTitle(nodeData as AccountTreeNode)}
          selectedKeys={selectedId ? [selectedId] : []}
          expandedKeys={expandedKeys}
          onExpand={(keys) => setExpandedKeys(keys.map(String))}
          onSelect={(keys) => {
            const nextId = keys[0];
            if (typeof nextId === 'string') onSelect(nextId);
          }}
        />
      </div>
    </aside>
  );
}
