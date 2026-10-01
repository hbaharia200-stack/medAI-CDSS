import type { ComponentType } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ClipboardCheck,
  DollarSign,
  Download,
  FileText,
  FolderOpen,
  Globe,
  Heart,
  HeartPulse,
  Home,
  Languages,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Mic,
  MicOff,
  Moon,
  Paperclip,
  Phone,
  PhoneCall,
  PhoneOff,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  Sun,
  User,
  UserRound,
  Users,
  Video,
  X,
  type LucideProps,
} from 'lucide-react';

type P = {
  width?: number | string;
  height?: number | string;
  className?: string;
};

/** Thin single-weight line icons backed by lucide-react (stroke 1.75, no duotone fill). */
function make(LucideIcon: ComponentType<LucideProps>) {
  return function Icon({ width = 24, height = 24, className }: P) {
    return (
      <LucideIcon
        width={width}
        height={height}
        className={className}
        strokeWidth={1.75}
        aria-hidden
      />
    );
  };
}

/** Compact set of professional line icons (no emoji). */
export const Icons = {
  home: make(Home),
  users: make(Users),
  userRound: make(UserRound),
  stethoscope: make(Stethoscope),
  activity: make(Activity),
  clipboardCheck: make(ClipboardCheck),
  folderOpen: make(FolderOpen),
  heartPulse: make(HeartPulse),
  chartBar: make(BarChart3),
  calendar: make(Calendar),
  calendarClock: make(CalendarClock),
  messageCircle: make(MessageCircle),
  phone: make(Phone),
  dollarSign: make(DollarSign),
  settings: make(Settings),
  logOut: make(LogOut),
  chevronDown: make(ChevronDown),
  chevronUp: make(ChevronUp),
  chevronLeft: make(ChevronLeft),
  chevronRight: make(ChevronRight),
  chevronsLeft: make(ChevronsLeft),
  chevronsRight: make(ChevronsRight),
  globe: make(Globe),
  language: make(Languages),
  sun: make(Sun),
  moon: make(Moon),
  user: make(User),
  fileText: make(FileText),
  x: make(X),
  menu: make(Menu),
  video: make(Video),
  mic: make(Mic),
  micOff: make(MicOff),
  phoneOff: make(PhoneOff),
  play: make(Play),
  download: make(Download),
  send: make(Send),
  paperclip: make(Paperclip),
  plus: make(Plus),
  search: make(Search),
  check: make(Check),
  arrowRight: make(ArrowRight),
  mail: make(Mail),
  phoneCall: make(PhoneCall),
  mapPin: make(MapPin),
  heart: make(Heart),
  shield: make(ShieldCheck),
};
