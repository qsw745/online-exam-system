import React from 'react'
import { Row, Col } from 'antd'
import StatsCard, { type StatsCardProps } from './StatsCard'

export interface StatsCardGroupProps {
  items: StatsCardProps[]
  /** 栅格列数（响应式） */
  cols?: Partial<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', number>>
  /** 间距（px），默认 12 */
  gutter?: number
}

const defaultCols = { xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }

function StatsCardGroup({ items, cols = defaultCols, gutter = 12 }: StatsCardGroupProps) {
  const spanFromCols = (n?: number) => (n ? 24 / n : undefined)

  return (
    <Row gutter={gutter}>
      {items.map((it, idx) => (
        <Col
          key={idx}
          xs={spanFromCols(cols.xs)}
          sm={spanFromCols(cols.sm)}
          md={spanFromCols(cols.md)}
          lg={spanFromCols(cols.lg)}
          xl={spanFromCols(cols.xl)}
          xxl={spanFromCols(cols.xxl)}
          style={{ marginBottom: gutter }}
        >
          <StatsCard {...it} />
        </Col>
      ))}
    </Row>
  )
}

export default StatsCardGroup
