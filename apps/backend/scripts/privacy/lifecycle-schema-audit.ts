import { pool } from '../../src/config/database'
import { LifecycleDatasetCoverageError } from '../../src/modules/privacy-lifecycle/domain/data-handler.registry'
import { LifecycleSchemaAuditService } from '../../src/modules/privacy-lifecycle/services/lifecycle-schema-audit.service'

async function main(): Promise<void> {
  try {
    const report = await new LifecycleSchemaAuditService(pool).inspect()
    console.log(JSON.stringify({
      status: 'COVERED',
      coveredColumnCount: report.coveredColumnCount,
      categoryCounts: report.categoryCounts,
    }))
  } catch (error) {
    if (error instanceof LifecycleDatasetCoverageError) {
      console.error(JSON.stringify({
        status: 'BLOCKED',
        code: error.code,
        uncovered: error.uncovered.map(item => ({ tableName: item.tableName, columnName: item.columnName })),
      }))
    } else {
      console.error(JSON.stringify({ status: 'FAILED', code: 'LIFECYCLE_SCHEMA_AUDIT_FAILED' }))
    }
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
