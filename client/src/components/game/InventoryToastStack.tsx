import React, { useEffect, useState } from 'react';
import { InventoryNotification } from '../../types';
import { Package, AlertTriangle, X, Sparkles } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface InventoryToastStackProps {
  notifications: InventoryNotification[];
  onDismiss: (id: string) => void;
}

export const InventoryToastStack: React.FC<InventoryToastStackProps> = ({
  notifications,
  onDismiss,
}) => {
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      if (latest.action === 'add') {
        soundFx.playLootPickup();
      }
    }
  }, [notifications.length]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => {
        const isAdd = notif.action === 'add';

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all animate-slide-in-right flex items-start gap-3 ${
              isAdd
                ? 'bg-slate-950/95 border-emerald-500/60 shadow-emerald-950/40 text-slate-100'
                : 'bg-slate-950/95 border-rose-500/60 shadow-rose-950/40 text-slate-100'
            }`}
          >
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isAdd
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
              }`}
            >
              {isAdd ? (
                <Package className="w-5 h-5 animate-bounce" />
              ) : (
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider font-mono ${
                    isAdd ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {isAdd ? '🎒 Предмет добавлен' : '⚠️ Предмет утрачен'}
                </span>
                <button
                  type="button"
                  onClick={() => onDismiss(notif.id)}
                  className="text-slate-500 hover:text-slate-200 transition-colors p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs font-semibold text-slate-100 leading-tight">
                <strong className="text-amber-400">{notif.characterName}</strong>:{' '}
                {isAdd ? 'получил' : 'лишился'} «
                <span className="text-amber-200">{notif.itemName}</span>»
                {notif.quantity > 1 ? ` (${notif.quantity} шт.)` : ''}
              </div>

              {notif.reason && (
                <p className="text-[11px] text-slate-400 mt-1 leading-snug truncate">
                  {notif.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
