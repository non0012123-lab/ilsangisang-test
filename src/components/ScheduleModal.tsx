import { useState, useRef, type ChangeEvent } from 'react';
import { X, Upload } from 'lucide-react';
import type { ScheduleEntry, Category, ScheduleStatus } from '../types';
import { CLIENTS, USERS } from '../data/mockData';

const CATEGORIES: Category[] = ['SNS', '유튜브', '네이버', '영상제작', '디자인제작', '기타'];
const STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: 'pending', label: '대기중' },
  { value: 'in-progress', label: '진행중' },
  { value: 'completed', label: '완료' },
];

interface Props {
  entry?: ScheduleEntry | null;
  onSave: (entry: ScheduleEntry) => void;
  onClose: () => void;
}

export default function ScheduleModal({ entry, onSave, onClose }: Props) {
  const [form, setForm] = useState<Partial<ScheduleEntry>>(
    entry ?? {
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      category: 'SNS',
      clientId: CLIENTS[0].id,
      clientName: CLIENTS[0].name,
      managerId: USERS.find(u => u.role !== 'client')?.id ?? '',
      managerName: USERS.find(u => u.role !== 'client')?.name ?? '',
    }
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof ScheduleEntry, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleClient = (id: string) => {
    const c = CLIENTS.find(c => c.id === id);
    if (c) setForm(prev => ({ ...prev, clientId: c.id, clientName: c.name }));
  };

  const handleManager = (id: string) => {
    const u = USERS.find(u => u.id === id);
    if (u) setForm(prev => ({ ...prev, managerId: u.id, managerName: u.name }));
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => set('screenshot', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!form.date || !form.keyword || !form.link || !form.clientId || !form.managerId) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }
    onSave({
      id: entry?.id ?? Date.now().toString(),
      date: form.date!,
      managerId: form.managerId!,
      managerName: form.managerName!,
      category: form.category!,
      keyword: form.keyword!,
      link: form.link!,
      rank: form.rank,
      screenshot: form.screenshot,
      clientId: form.clientId!,
      clientName: form.clientName!,
      status: form.status!,
      notes: form.notes,
    });
  };

  const managers = USERS.filter(u => u.role !== 'client');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {entry ? '스케줄 수정' : '스케줄 추가'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">날짜 *</label>
              <input
                type="date"
                value={form.date ?? ''}
                onChange={e => set('date', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">상태 *</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {/* Manager */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">담당자 *</label>
              <select
                value={form.managerId}
                onChange={e => handleManager(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {managers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            {/* Client */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">클라이언트 *</label>
              <select
                value={form.clientId}
                onChange={e => handleClient(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLIENTS.filter(c => c.status !== 'inactive').map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">카테고리 *</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {/* Rank */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">순위</label>
              <input
                type="number"
                min={1}
                value={form.rank ?? ''}
                onChange={e => set('rank', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="예: 3"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Keyword */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">키워드 *</label>
            <input
              type="text"
              value={form.keyword ?? ''}
              onChange={e => set('keyword', e.target.value)}
              placeholder="검색 키워드 입력"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">링크 *</label>
            <input
              type="url"
              value={form.link ?? ''}
              onChange={e => set('link', e.target.value)}
              placeholder="https://example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">캡처본</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {form.screenshot ? (
              <div className="relative inline-block">
                <img src={form.screenshot} alt="캡처본" className="h-24 rounded-lg border border-gray-200 object-cover" />
                <button
                  onClick={() => set('screenshot', undefined)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                <Upload size={14} />
                이미지 업로드
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">메모</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="추가 메모 사항"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {entry ? '수정하기' : '추가하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
