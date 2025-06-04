import { useRealTime } from '@/contexts/RealTimeContext';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

export function RealTimeStatus() {
  const { isConnected, connectionStatus } = useRealTime();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'Live',
          variant: 'default' as const,
          className: 'bg-green-500 hover:bg-green-600 text-white'
        };
      case 'connecting':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Connecting...',
          variant: 'secondary' as const,
          className: 'bg-yellow-500 hover:bg-yellow-600 text-white'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Offline',
          variant: 'destructive' as const,
          className: 'bg-red-500 hover:bg-red-600 text-white'
        };
      default:
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Unknown',
          variant: 'secondary' as const,
          className: ''
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge 
      variant={config.variant}
      className={`flex items-center gap-1 ${config.className}`}
    >
      {config.icon}
      <span className="text-xs font-medium">{config.text}</span>
    </Badge>
  );
}