import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, AlertCircle, CheckCircle2, Wrench, FolderKanban } from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface TeamItem {
  _id: string;
  teamCode: string;
  name: string;
  department: string;
  purpose: string;
  skills: string[];
  eligibility: {
    projectTasks: boolean;
    serviceVisits: boolean;
  };
  isActive: boolean;
  teamLeadId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    employeeCode?: string;
  };
  memberUserIds?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeCode?: string;
  }>;
  activeTasks?: number;
}

export const TeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [nameInput, setNameInput] = useState('');
  const [deptInput, setDeptInput] = useState('OPERATIONS');
  const [purposeInput, setPurposeInput] = useState('');
  const [teamLeadIdInput, setTeamLeadIdInput] = useState('');
  const [memberIdsInput, setMemberIdsInput] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [eligProjectTasks, setEligProjectTasks] = useState(true);
  const [eligServiceVisits, setEligServiceVisits] = useState(true);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (selectedDept) queryParams.set('department', selectedDept);
      if (activeFilter !== '') queryParams.set('isActive', activeFilter);

      const res = await apiClient<{ items: TeamItem[] }>(`/teams?${queryParams.toString()}`);
      setTeams(res?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [search, selectedDept, activeFilter]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || !purposeInput.trim() || !teamLeadIdInput.trim()) {
      setFormError('Team name, purpose, and Team Lead ID are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const memberUserIds = memberIdsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const skills = skillsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await apiClient('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: nameInput.trim(),
          department: deptInput,
          purpose: purposeInput.trim(),
          teamLeadId: teamLeadIdInput.trim(),
          memberUserIds,
          skills,
          eligibility: {
            projectTasks: eligProjectTasks,
            serviceVisits: eligServiceVisits
          }
        })
      });

      setCreateModalOpen(false);
      setNameInput('');
      setPurposeInput('');
      setTeamLeadIdInput('');
      setMemberIdsInput('');
      setSkillsInput('');
      fetchTeams();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create team.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (team: TeamItem) => {
    const nextStatus = !team.isActive;
    const confirmMsg = nextStatus
      ? `Activate team ${team.name}?`
      : `Deactivate team ${team.name}? Members will remain unassigned.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await apiClient(`/teams/${team._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          isActive: nextStatus,
          reason: nextStatus ? 'Reactivated by manager' : 'Deactivated from UI'
        })
      });
      fetchTeams();
    } catch (err: any) {
      alert(err?.message || 'Failed to update team status.');
    }
  };

  // Stats
  const totalTeams = teams.length;
  const activeCount = teams.filter(t => t.isActive).length;
  const projectEligible = teams.filter(t => t.eligibility?.projectTasks && t.isActive).length;
  const serviceEligible = teams.filter(t => t.eligibility?.serviceVisits && t.isActive).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Crews & Team Management
          </h1>
          <p className="text-sm text-gray-500">
            Field installation crews, service technician squads, and departmental squads.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Create New Crew/Team
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalTeams}</div>
            <div className="text-xs text-gray-500">Total Teams Registered</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
            <div className="text-xs text-gray-500">Operational Crews</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{projectEligible}</div>
            <div className="text-xs text-gray-500">Project Installation Crews</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{serviceEligible}</div>
            <div className="text-xs text-gray-500">Service Squads Eligible</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search team code, crew name, or purpose..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Departments</option>
          <option value="OPERATIONS">Operations & Projects</option>
          <option value="SERVICES">Field Service & Maintenance</option>
          <option value="ENGINEERING">Design & Engineering</option>
          <option value="SALES">Sales & BD</option>
        </select>

        <select
          value={activeFilter}
          onChange={e => setActiveFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive / Disbanded</option>
        </select>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Teams Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading crews & squads...</div>
      ) : teams.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No teams found matching the filters.</p>
          <p className="text-sm text-gray-400">
            Click &apos;Create New Crew/Team&apos; to register one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => {
            const leadName = team.teamLeadId
              ? `${team.teamLeadId.firstName} ${team.teamLeadId.lastName}`
              : 'Unassigned';
            const memberCount = team.memberUserIds?.length || 0;

            return (
              <div
                key={team._id}
                className={`bg-white rounded-xl border ${
                  team.isActive
                    ? 'border-gray-200 shadow-sm'
                    : 'border-gray-200 bg-gray-50/70 opacity-75'
                } p-5 space-y-4 hover:shadow-md transition flex flex-col justify-between`}
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {team.teamCode}
                      </span>
                      <h3 className="text-base font-bold text-gray-900 mt-1">{team.name}</h3>
                      <span className="text-xs text-gray-500">{team.department}</span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        team.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {team.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 line-clamp-2">{team.purpose}</p>

                  {/* Team Lead */}
                  <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                    <div className="text-gray-400 font-medium uppercase text-[10px] tracking-wider">
                      Crew Lead
                    </div>
                    <div className="font-semibold text-gray-800">{leadName}</div>
                    {team.teamLeadId?.phone && (
                      <div className="text-gray-500 text-[11px]">{team.teamLeadId.phone}</div>
                    )}
                  </div>

                  {/* Member count and Eligibility */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-500 font-medium">
                      Crew Members: <strong className="text-gray-800">{memberCount}</strong>
                    </span>
                    <div className="flex gap-1.5">
                      {team.eligibility?.projectTasks && (
                        <span
                          className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded"
                          title="Eligible for Project Tasks"
                        >
                          Projects
                        </span>
                      )}
                      {team.eligibility?.serviceVisits && (
                        <span
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded"
                          title="Eligible for Field Service Visits"
                        >
                          Service
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skills tags */}
                  {team.skills && team.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {team.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {team.activeTasks ? `${team.activeTasks} active tasks` : '0 active tasks'}
                  </span>
                  <button
                    onClick={() => handleToggleStatus(team)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded transition ${
                      team.isActive
                        ? 'text-red-600 hover:bg-red-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {team.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Team */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Register New Crew / Operational Team
            </h3>
            <p className="text-xs text-gray-500">
              Crews can be assigned project installation tasks and scheduled service visits.
            </p>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. North Delhi Rooftop Installation Crew A"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                <select
                  value={deptInput}
                  onChange={e => setDeptInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="OPERATIONS">Operations & Projects</option>
                  <option value="SERVICES">Field Service & Maintenance</option>
                  <option value="ENGINEERING">Design & Engineering</option>
                  <option value="SALES">Sales & BD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Purpose / Responsibility *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Turnkey residential solar installations (1-10kW) and mounting structures"
                  value={purposeInput}
                  onChange={e => setPurposeInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Team Lead User ID (Hex Object ID) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 64b8f... (Supervisor user ID)"
                  value={teamLeadIdInput}
                  onChange={e => setTeamLeadIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Member User IDs (comma-separated Hex IDs)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 64b8f1..., 64b8f2..."
                  value={memberIdsInput}
                  onChange={e => setMemberIdsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Specialization Skills (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rooftop-Structure, String-Inverter, Safety-Harness"
                  value={skillsInput}
                  onChange={e => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Assignment Eligibility
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eligProjectTasks}
                      onChange={e => setEligProjectTasks(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Eligible for Project Tasks
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eligServiceVisits}
                      onChange={e => setEligServiceVisits(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Eligible for Service Visits
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Team...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
