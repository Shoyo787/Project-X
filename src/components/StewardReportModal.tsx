import React from 'react';
import {
  CheckCircle2,
  Coins,
  Hammer,
  ScrollText,
  Sparkles,
  Swords,
  Warehouse,
} from 'lucide-react';
import { formatDurationShort } from '../game/utils/format';
import { OfflineReport } from '../types/game';

interface StewardReportModalProps {
  report: OfflineReport;
  onDismiss: () => void;
}

export const StewardReportModal: React.FC<StewardReportModalProps> = ({
  report,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2623]/45 p-4 backdrop-blur-[2px]">
      <div className="parchment-panel w-full max-w-md rounded-2xl p-6">
        <div className="flex items-center gap-3 border-b border-[#8c6d46]/35 pb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#2b2623] bg-[#f4c76b]">
            <ScrollText className="h-6 w-6 text-[#2b2623]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#8c6d46]">
              Welcome Back, Warden
            </p>
            <h2 className="font-display text-xl font-extrabold text-[#2b2623]">
              Steward&apos;s Report
            </h2>
          </div>
        </div>

        <p className="mt-3 text-sm text-[#4f4335]">
          While you were away for{' '}
          <strong className="font-mono text-[#2b2623]">
            {formatDurationShort(report.elapsedSeconds)}
          </strong>
          , your garrison defended the valley road and mines worked steadily.
        </p>

        {/* Loot & Defense Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="parchment-card rounded-xl p-2.5 text-center">
            <Coins className="mx-auto h-4 w-4 text-[#c78b2a]" />
            <div className="mt-1 font-mono text-sm font-bold text-[#2b2623]">
              +{report.goldEarned}
            </div>
            <div className="text-[10px] font-semibold text-[#6b5a44]">
              Gold/Timber
            </div>
          </div>

          <div className="parchment-card rounded-xl p-2.5 text-center">
            <Sparkles className="mx-auto h-4 w-4 text-[#438e9e]" />
            <div className="mt-1 font-mono text-sm font-bold text-[#2b2623]">
              +{report.aetherEarned}
            </div>
            <div className="text-[10px] font-semibold text-[#6b5a44]">Aether</div>
          </div>

          <div className="parchment-card rounded-xl p-2.5 text-center">
            <Swords className="mx-auto h-4 w-4 text-[#c86446]" />
            <div className="mt-1 font-mono text-sm font-bold text-[#2b2623]">
              {report.raidersDefeated}
            </div>
            <div className="text-[10px] font-semibold text-[#6b5a44]">
              Raiders Slain
            </div>
          </div>
        </div>

        {/* Storage Vault Cap Notice */}
        {(report.wasGoldCapped || report.wasAetherCapped) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#c86446] bg-[#fbe9e2] px-3 py-2 text-xs font-semibold text-[#8c3b23]">
            <Warehouse className="h-4 w-4 shrink-0" />
            <span>
              Your Storage Vaults reached full capacity! Upgrade or build another
              Storage Vault to hold larger offline harvests.
            </span>
          </div>
        )}

        {/* Completed Upgrades */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#6b5a44]">
            <Hammer className="h-3.5 w-3.5 text-[#8c6d46]" />
            Completed Construction ({report.completedUpgrades.length})
          </div>
          {report.completedUpgrades.length === 0 ? (
            <p className="mt-1.5 text-xs italic text-[#7a6850]">
              No upgrades completed while away.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {report.completedUpgrades.map((item, idx) => (
                <li
                  key={`${item.entityName}-${idx}`}
                  className="parchment-card flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-bold text-[#2b2623]"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#648753]" />
                    {item.entityName}
                  </span>
                  <span className="font-mono text-[#8c6d46]">
                    Reached Lv.{item.newLevel}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="ink-button mt-5 w-full cursor-pointer rounded-xl bg-[#7c9a6e] py-2.5 text-sm font-bold text-white hover:bg-[#6a875d]"
        >
          Collect &amp; Command Bastion
        </button>
      </div>
    </div>
  );
};
