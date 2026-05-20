// Galeria de ícones Lucide disponíveis para grupos de Links Úteis
import {
  Link,
  Folder,
  BookOpen,
  FileText,
  Settings,
  Users,
  User,
  Shield,
  Star,
  Heart,
  Globe,
  Mail,
  Phone,
  MessageCircle,
  Calendar,
  ClipboardList,
  Briefcase,
  Building2,
  GraduationCap,
  Award,
  Target,
  Wrench,
  HelpCircle,
  Info,
  AlertCircle,
  Bell,
  Bookmark,
  Tag,
  Layers,
  Library,
  Map,
  MapPin,
  Camera,
  Image as ImageIcon,
  Video,
  Music,
  Download,
  Upload,
  Lock,
  Key,
  Database,
  Server,
  Monitor,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export const ICONES_LINKS_UTEIS: Record<string, LucideIcon> = {
  Link, Folder, BookOpen, FileText, Settings, Users, User, Shield, Star, Heart,
  Globe, Mail, Phone, MessageCircle, Calendar, ClipboardList, Briefcase, Building2,
  GraduationCap, Award, Target, Wrench, HelpCircle, Info, AlertCircle, Bell,
  Bookmark, Tag, Layers, Library, Map, MapPin, Camera, Image: ImageIcon, Video,
  Music, Download, Upload, Lock, Key, Database, Server, Monitor, Smartphone,
};

export const ICONES_LINKS_UTEIS_LISTA = Object.keys(ICONES_LINKS_UTEIS);

export function getIconeLink(nome: string | null | undefined): LucideIcon {
  if (!nome) return Link;
  return ICONES_LINKS_UTEIS[nome] ?? Link;
}

export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
