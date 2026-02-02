import requests
import sys
BASE='http://localhost:6100'

def login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"email":email, "password":password})
    r.raise_for_status()
    return r.json()['access_token']

try:
    plat_token = login('super_user@jspark.com','jspark123')
    print('Got platform token')
    headers = {'Authorization': f'Bearer {plat_token}'}
    create = requests.post(f"{BASE}/api/budgets/", json={
        'name':'ScriptBudget','fiscal_year':2026,'fiscal_quarter':2,'total_points':1000,'expiry_date':'2026-06-30T00:00:00Z'
    }, headers=headers)
    print('Create status', create.status_code, create.text)
    create.raise_for_status()
    budget = create.json()
    bid = budget['id']

    hr_token = login('hr@jspark.com','jspark123')
    print('Got HR token')
    h=headers={'Authorization': f'Bearer {hr_token}'}
    deps = requests.get(f"{BASE}/api/tenants/departments", headers=h)
    print('Depts status', deps.status_code)
    deps.raise_for_status()
    dept_id = deps.json()[0]['id']
    print('dept_id', dept_id)

    alloc = requests.post(f"{BASE}/api/budgets/{bid}/allocate", json={'allocations':[{'department_id':dept_id,'allocated_points':10}]}, headers=h)
    print('Alloc status', alloc.status_code, alloc.text)
    alloc.raise_for_status()
    print('Allocation successful')

except Exception as e:
    print('ERROR', e)
    sys.exit(1)

print('Done')
