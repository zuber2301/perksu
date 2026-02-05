import { HiOutlineCash } from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'
import StatCard from './StatCard'

export default function WalletBalance({ wallet }) {
  return (
    <StatCard
      title="Points Balance"
      value={wallet ? formatCurrency(wallet.balance) : '---'}
      icon={<HiOutlineCash className="w-6 h-6 text-white" />}
      gradient
      loading={!wallet}
      footerLeft={
        <span className="text-white/80">
          Earned: {wallet ? formatCurrency(wallet.lifetime_earned) : '---'}
        </span>
      }
      footerRight={
        <span className="text-white/80">
          Spent: {wallet ? formatCurrency(wallet.lifetime_spent) : '---'}
        </span>
      }
    />
  )
}
