/**
 * User Management Screen - Admin
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  GlassStyles,
  Spacing,
  BorderRadius,
  LayoutStyles,
} from '../../theme';
import { useAuth } from '../../services/AuthContext';

// Mock users data
const MOCK_USERS = [
  { id: '1', name: 'Arjun Kumar', email: 'student@gyan.com', role: 'student', status: 'active' },
  { id: '2', name: 'Dr. Priya Sharma', email: 'teacher@gyan.com', role: 'teacher', status: 'active' },
  { id: '3', name: 'Rahul Singh', email: 'admin@gyan.com', role: 'admin', status: 'active' },
  { id: '4', name: 'Meera Patel', email: 'meera@gyan.com', role: 'student', status: 'active' },
  { id: '5', name: 'Prof. Amit Verma', email: 'amit@gyan.com', role: 'teacher', status: 'inactive' },
  { id: '6', name: 'Sneha Gupta', email: 'sneha@gyan.com', role: 'student', status: 'active' },
];

const UserManagementScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState(MOCK_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return Colors.coral;
      case 'teacher': return Colors.gold;
      case 'student': return Colors.emeraldLight;
      default: return Colors.text.muted;
    }
  };

  const getStatusColor = (status) => {
    return status === 'active' ? Colors.success : Colors.text.muted;
  };

  const toggleUserStatus = (userId) => {
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
        : u
    ));
  };

  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  return (
    <View style={LayoutStyles.screen}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={TextStyles.body}>Admin Panel</Text>
            <Text style={TextStyles.h2}>{user?.name || 'Admin'}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={TextStyles.statValue}>{stats.total}</Text>
            <Text style={TextStyles.bodySmall}>Total Users</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={[TextStyles.statValue, { color: Colors.emeraldLight }]}>{stats.students}</Text>
            <Text style={TextStyles.bodySmall}>Students</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={[TextStyles.statValue, { color: Colors.gold }]}>{stats.teachers}</Text>
            <Text style={TextStyles.bodySmall}>Teachers</Text>
          </GlassCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('ClassAssignment')}
          >
            <GlassCard style={styles.actionCard}>
              <Text style={styles.actionIcon}>🏫</Text>
              <Text style={TextStyles.label}>Class Assignment</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('ModelSwitcher')}
          >
            <GlassCard style={styles.actionCard}>
              <Text style={styles.actionIcon}>🤖</Text>
              <Text style={TextStyles.label}>AI Models</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Search & Filter */}
        <GlassCard style={styles.searchCard}>
          <TextInput
            style={[GlassStyles.input, styles.searchInput]}
            placeholder="Search users..."
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterRow}>
            {['all', 'student', 'teacher', 'admin'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.filterBtn,
                  filterRole === role && styles.filterBtnActive,
                ]}
                onPress={() => setFilterRole(role)}
              >
                <Text style={[
                  styles.filterBtnText,
                  filterRole === role && styles.filterBtnTextActive,
                ]}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Users List */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>
          Users ({filteredUsers.length})
        </Text>

        {filteredUsers.map((u) => (
          <GlassCard key={u.id} style={styles.userCard}>
            <View style={styles.userRow}>
              <LinearGradient
                colors={[getRoleColor(u.role), Colors.glass.background]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {u.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </LinearGradient>

              <View style={styles.userInfo}>
                <Text style={TextStyles.label}>{u.name}</Text>
                <Text style={TextStyles.bodySmall}>{u.email}</Text>
                <View style={styles.badges}>
                  <View style={[styles.badge, { backgroundColor: getRoleColor(u.role) + '30' }]}>
                    <Text style={[styles.badgeText, { color: getRoleColor(u.role) }]}>
                      {u.role}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(u.status) }]} />
                  <Text style={[TextStyles.bodySmall, { color: getStatusColor(u.status) }]}>
                    {u.status}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.actionToggle}
                onPress={() => toggleUserStatus(u.id)}
              >
                <Text style={styles.actionToggleText}>
                  {u.status === 'active' ? '🔒' : '🔓'}
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xxl,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoutBtn: {
    backgroundColor: Colors.glass.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  logoutText: {
    color: Colors.coral,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionBtn: {
    flex: 1,
  },
  actionCard: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  searchCard: {
    marginBottom: Spacing.xxl,
  },
  searchInput: {
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.emerald,
    borderColor: Colors.emerald,
  },
  filterBtnText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterBtnTextActive: {
    color: Colors.white,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  userCard: {
    marginBottom: Spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionToggle: {
    padding: Spacing.sm,
  },
  actionToggleText: {
    fontSize: 20,
  },
});

export default UserManagementScreen;
