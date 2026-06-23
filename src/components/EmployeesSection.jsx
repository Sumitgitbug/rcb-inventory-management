import { Plus } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"

function EmployeesSection({ employees, onAddEmployee, onEditEmployee, onRemoveEmployee }) {
  return (
    <SectionShell
      title="Employee Details"
      description="Employee code, employee name, and email."
      action={
        onAddEmployee ? (
          <ActionButton onClick={onAddEmployee}>
            <Plus className="size-4" />
            Add Employee
          </ActionButton>
        ) : null
      }
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Employee Code</th>
              <th className="px-4 py-3 font-medium">Employee Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              {onEditEmployee || onRemoveEmployee ? <th className="px-4 py-3 font-medium">Action</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {employees.length ? (
              employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-4 font-medium text-slate-900">{employee.code}</td>
                  <td className="px-4 py-4 text-slate-700">{employee.name}</td>
                  <td className="px-4 py-4 text-slate-700">{employee.email}</td>
                  {onEditEmployee || onRemoveEmployee ? (
                    <td className="px-4 py-4 text-slate-700">
                      <div className="flex gap-2">
                        {onEditEmployee ? (
                          <ActionButton className="px-3 py-1.5 text-xs" onClick={() => onEditEmployee(employee)}>
                            Edit
                          </ActionButton>
                        ) : null}
                        {onRemoveEmployee ? (
                          <ActionButton className="bg-rose-500 px-3 py-1.5 text-xs hover:bg-rose-600" onClick={() => onRemoveEmployee(employee.id)}>
                            Delete
                          </ActionButton>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={onEditEmployee || onRemoveEmployee ? 4 : 3} className="px-4 py-8 text-center text-sm text-slate-500">
                  No employees added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  )
}

export default EmployeesSection
