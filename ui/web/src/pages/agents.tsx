import { useState } from 'react'
import { Search } from 'lucide-react'
import { AgentsTable, useAgentRows } from '@/components/agents-table'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AgentsPage() {
  const rows = useAgentRows()
  const [query, setQuery] = useState('')
  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.id.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold">AI Agents</h1>
        <p className="text-muted-foreground text-sm">Monitor and manage your AI agents</p>
      </div>
      <div className="flex gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search agents..."
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select defaultValue="session">
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="session">Session</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent>
          <AgentsTable rows={filtered} />
        </CardContent>
      </Card>
    </div>
  )
}
