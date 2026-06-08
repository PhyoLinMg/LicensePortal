import type { License } from '../_lib/types'
import { fmtTs } from '../_lib/format'
import Section from './Section'
import MetaItem from './MetaItem'

type Props = Pick<License, 'id' | 'issuedAt' | 'expiresAt' | 'customer' | 'product' | 'gracePeriodDays' | 'heartbeatUrl'>

export default function LicenseMetadataGrid({ license }: { license: Props }) {
  return (
    <Section title="Details">
      <div className="grid grid-cols-3 gap-x-6 gap-y-[18px]">
        <MetaItem label="License ID" value={license.id} mono />
        <MetaItem label="Issued" value={fmtTs(license.issuedAt)} />
        <MetaItem label="Expires" value={fmtTs(license.expiresAt)} />
        <MetaItem
          label="Customer"
          value={`${license.customer.name}${license.customer.email ? ` · ${license.customer.email}` : ''}`}
        />
        <MetaItem label="Product" value={`${license.product.name} (${license.product.slug})`} />
        <MetaItem label="Key ID" value={license.product.keyId} mono />
        <MetaItem label="Grace Period" value={`${license.gracePeriodDays} days`} />
        {license.heartbeatUrl && (
          <div className="col-span-3">
            <MetaItem label="Heartbeat URL" value={license.heartbeatUrl} mono />
          </div>
        )}
      </div>
    </Section>
  )
}
