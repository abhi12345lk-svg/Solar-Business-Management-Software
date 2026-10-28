import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  UserX,
  AlertCircle,
  Clock,
  FolderKanban
} from 'lucide-react';
import { apiClient } from '../lib/api.js';

interface EmployeeItem {
  _id: string;
  employeeCode: string;
  designation: string;
  department: string;
  isTeamLead: boolean;
  employmentStatus: string;
  availability: string;
  joiningDate: string;
  skills: string[];
  isActive: boolean;
  notes?: string;
  userId?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    department: string;
    isActive: boolean;
  };
  teamId?: {
    _id: string;
    teamCode: string;
    name: string;
    purpose: string;
  };
  workload?: {
    activeTasks: number;
    activeVisits: number;
    activeProjects: number;
  };
}

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<EmployeeItem | null>(null);

  // Form State for Profile Creation
  const [userIdInput, setUserIdInput] = useState('');
  const [designationInput, setDesignationInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('OPERATIONS');
  const [skillsInput, setSkillsInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deactivation Form
  const [reassignUserId, setReassignUserId] = useState('');
  const [deactivationReason, setDeactivationReason] = useState('');

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (search.trim()) queryParams.set('search', search.trim());
      if (selectedDept) queryParams.set('department', selectedDept);
      if (selectedAvailability) queryParams.set('availability', selectedAvailability);
      if (selectedStatus) queryParams.set('employmentStatus', selectedStatus);

      const res = await apiClient<{ items: EmployeeItem[] }>(
        `/employees?${queryParams.toString()}`
      );
      setEmployees(res?.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedAvailability, selectedStatus]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdInput.trim() || !designationInput.trim()) {
      setFormError('User ID and Designation are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const skills = skillsInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      await apiClient('/employees', {
        method: 'POST',
        body: JSON.stringify({
          userId: userIdInput.trim(),
          designation: designationInput.trim(),
          department: departmentInput,
          skills,
          notes: notesInput.trim() || undefined
        })
      });

      setCreateModalOpen(false);
      setUserIdInput('');
      setDesignationInput('');
      setSkillsInput('');
      setNotesInput('');
      fetchEmployees();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create employee profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;

    try {
      setIsSubmitting(true);
      setFormError(null);
      await apiClient(`/employees/${targetEmployee._id}/deactivate`, {
        method: 'PATCH',
        body: JSON.stringify({
          reassignToUserId: reassignUserId.trim() || undefined,
          deactivationReason: deactivationReason.trim() || 'Voluntary exit'
        })
      });

      setDeactivateModalOpen(false);
      setTargetEmployee(null);
      setReassignUserId('');
      setDeactivationReason('');
      fetchEmployees();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to deactivate employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats calculation
  const totalEmployees = employees.length;
  const activeCount = employees.filter(e => e.isActive).length;
  const availableCount = employees.filter(e => e.availability === 'AVAILABLE' && e.isActive).length;
  const totalWorkload = employees.reduce(
    (sum, e) => sum + (e.workload?.activeTasks || 0) + (e.workload?.activeVisits || 0),
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-amber-500" />
            Employee Directory & Workload
          </h1>
          <p className="text-sm text-gray-500">
            Internal operations staff, crew assignments, real-time workload, and skills inventory.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Link New Employee
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalEmployees}</div>
            <div className="text-xs text-gray-500">Total Personnel</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
            <div className="text-xs text-gray-500">Active Employment</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{availableCount}</div>
            <div className="text-xs text-gray-500">Available For Dispatch</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{totalWorkload}</div>
            <div className="text-xs text-gray-500">Assigned Tasks & Visits</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search code, designation, or keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">All Departments</option>
          <option value="OPERATIONS">Operations & Projects</option>
          <option value="SALES">Sales & Marketing</option>
          <option value="ENGINEERING">Design & Engineering</option>
          <option value="SERVICES">Field Service & AMC</option>
          <option value="FINANCE">Finance & Accounts</option>
          <option value="MANAGEMENT">Management</option>
        </select>

        <select
          value={selectedAvailability}
          onChange={e => setSelectedAvailability(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">All Availability</option>
          <option value="AVAILABLE">Available</option>
          <option value="BUSY">Busy</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>

        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PROBATION">Probation</option>
          <option value="NOTICE_PERIOD">Notice Period</option>
          <option value="TERMINATED">Terminated</option>
        </select>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading employee directory...</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-700">No employee profiles found.</p>
            <p className="text-sm text-gray-400">
              Try adjusting search filters or link a user account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Designation & Dept</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Availability</th>
                  <th className="py-3 px-4">Workload</th>
                  <th className="py-3 px-4">Skills</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => {
                  const fullName = emp.userId
                    ? `${emp.userId.firstName} ${emp.userId.lastName}`
                    : 'Unlinked Staff';
                  const email = emp.userId?.email || 'No email';
                  const phone = emp.userId?.phone;

                  return (
                    <tr key={emp._id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{fullName}</div>
                        <div className="text-xs text-amber-600 font-mono font-semibold">
                          {emp.employeeCode}
                        </div>
                        <div className="text-xs text-gray-400">
                          {email} {phone ? `• ${phone}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800">{emp.designation}</div>
                        <span className="inline-block mt-0.5 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {emp.department}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {emp.teamId ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800">{emp.teamId.name}</span>
                            <span className="text-xs text-gray-400 font-mono">
                              {emp.teamId.teamCode}
                            </span>
                            {emp.isTeamLead && (
                              <span className="text-[10px] uppercase font-bold text-amber-600">
                                Team Lead
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              emp.availability === 'AVAILABLE'
                                ? 'bg-emerald-500'
                                : emp.availability === 'BUSY'
                                  ? 'bg-amber-500'
                                  : 'bg-red-400'
                            }`}
                          />
                          <span className="text-xs font-medium text-gray-700 capitalize">
                            {emp.availability.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>
                        {!emp.isActive && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold uppercase">
                            Deactivated
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-medium ${
                              (emp.workload?.activeTasks || 0) > 0
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title="Active Project Tasks"
                          >
                            {emp.workload?.activeTasks || 0} tasks
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-medium ${
                              (emp.workload?.activeVisits || 0) > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title="Active Service Visits"
                          >
                            {emp.workload?.activeVisits || 0} visits
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {emp.skills && emp.skills.length > 0 ? (
                            emp.skills.slice(0, 3).map((skill, idx) => (
                              <span
                                key={idx}
                                className="text-[11px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
                              >
                                {skill}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs italic">None</span>
                          )}
                          {emp.skills && emp.skills.length > 3 && (
                            <span className="text-[10px] text-gray-400">
                              +{emp.skills.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        {emp.isActive ? (
                          <button
                            onClick={() => {
                              setTargetEmployee(emp);
                              setFormError(null);
                              setDeactivateModalOpen(true);
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Archived</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Link Employee Profile */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              Link Employee Profile
            </h3>
            <p className="text-xs text-gray-500">
              Attach operational HR metadata to an existing user without duplicating authentication
              credentials.
            </p>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  User ID (Hex Object ID) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 64b8f... (from Users system)"
                  value={userIdInput}
                  onChange={e => setUserIdInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Operational Designation *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Solar Engineer"
                  value={designationInput}
                  onChange={e => setDesignationInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Operational Department
                </label>
                <select
                  value={departmentInput}
                  onChange={e => setDepartmentInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="OPERATIONS">Operations & Projects</option>
                  <option value="SALES">Sales & Marketing</option>
                  <option value="ENGINEERING">Design & Engineering</option>
                  <option value="SERVICES">Field Service & AMC</option>
                  <option value="FINANCE">Finance & Accounts</option>
                  <option value="MANAGEMENT">Management</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HT-Metering, Inverter-Repairs, Rooftop-Civil"
                  value={skillsInput}
                  onChange={e => setSkillsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Operational or certification notes..."
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
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
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Linking...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Deactivate Employee */}
      {deactivateModalOpen && targetEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
              <UserX className="w-5 h-5" />
              Deactivate Employee: {targetEmployee.employeeCode}
            </h3>
            <p className="text-xs text-gray-600">
              This action terminates active employment status and revokes system access. Historical
              project tasks, service visits, and audit logs will be permanently preserved.
            </p>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleDeactivate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reassign Active Tasks/Visits To (Optional User ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replacement colleague User ID"
                  value={reassignUserId}
                  onChange={e => setReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Deactivation *
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Resignation, Role Relocation, Contract Completion..."
                  value={deactivationReason}
                  onChange={e => setDeactivationReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeactivateModalOpen(false);
                    setTargetEmployee(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
