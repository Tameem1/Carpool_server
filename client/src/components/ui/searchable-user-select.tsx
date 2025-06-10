import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  role?: string
}

interface SearchableUserSelectProps {
  users: any[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  excludeUserIds?: string[]
  showRole?: boolean
  allowSelf?: boolean
  selfLabel?: string
  selfValue?: string
}

export function SearchableUserSelect({
  users,
  value,
  onValueChange,
  placeholder = "اختر مستخدماً...",
  emptyMessage = "لا يوجد مستخدمين",
  disabled = false,
  className,
  excludeUserIds = [],
  showRole = false,
  allowSelf = false,
  selfLabel = "نفسي",
  selfValue = "self"
}: SearchableUserSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // Filter users based on exclusions and search
  const filteredUsers = React.useMemo(() => {
    if (!Array.isArray(users)) return []
    
    return users.filter(user => {
      // Exclude specified users
      if (excludeUserIds.includes(user.id)) return false
      
      // Search filter
      if (searchValue) {
        const searchLower = searchValue.toLowerCase()
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase()
        const email = user.email.toLowerCase()
        return fullName.includes(searchLower) || email.includes(searchLower)
      }
      
      return true
    })
  }, [users, excludeUserIds, searchValue])

  // Find selected user
  const selectedUser = React.useMemo(() => {
    if (value === selfValue && allowSelf) return null
    return Array.isArray(users) ? users.find((user: any) => user.id === value) : null
  }, [users, value, allowSelf, selfValue])

  const displayValue = React.useMemo(() => {
    if (value === selfValue && allowSelf) return selfLabel
    if (selectedUser) {
      const name = `${selectedUser.firstName} ${selectedUser.lastName}`
      if (showRole && selectedUser.role) {
        const roleLabel = selectedUser.role === 'admin' ? 'مدير' : 
                         selectedUser.role === 'driver' ? 'سائق' : 'راكب'
        return `${name} (${roleLabel})`
      }
      return name
    }
    return placeholder
  }, [selectedUser, value, allowSelf, selfValue, selfLabel, showRole, placeholder])

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue === value ? "" : selectedValue)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-right",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="البحث عن مستخدم..." 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {allowSelf && (
                <CommandItem
                  value={selfValue}
                  onSelect={() => handleSelect(selfValue)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === selfValue ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {selfLabel}
                </CommandItem>
              )}
              {filteredUsers.map((user) => {
                const displayName = `${user.firstName} ${user.lastName}`
                const roleLabel = showRole && user.role ? 
                  ` (${user.role === 'admin' ? 'مدير' : user.role === 'driver' ? 'سائق' : 'راكب'})` : ''
                
                return (
                  <CommandItem
                    key={user.id}
                    value={`${user.id}-${displayName}-${user.email}`}
                    onSelect={() => handleSelect(user.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === user.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col items-start">
                      <span>{displayName}{roleLabel}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}