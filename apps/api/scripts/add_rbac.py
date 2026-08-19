import sys
import re

def update_file(filename, prefix, permission):
    with open(filename, 'r') as f:
        content = f.read()

    # Add imports
    if 'core.security' not in content:
        if 'from fastapi import APIRouter, Depends, HTTPException' in content:
            content = content.replace('from fastapi import APIRouter, Depends, HTTPException', 'from fastapi import APIRouter, Depends, HTTPException\nfrom core.security import RequirePermissions, User')
        elif 'from fastapi import APIRouter, Depends' in content:
            content = content.replace('from fastapi import APIRouter, Depends', 'from fastapi import APIRouter, Depends\nfrom core.security import RequirePermissions, User')

    # Add dependency to routes
    pattern = r'(@router\.(get|post|put|delete)\(".*?"\)\n(?:async )?def .*?\((.*?)\):)'
    
    def replacer(match):
        full_match = match.group(1)
        args = match.group(3)
        if 'user: User = Depends' in args:
            return full_match
        
        if args.strip() == '':
            new_args = f'user: User = Depends(RequirePermissions("{permission}"))'
        elif args.endswith(','):
            new_args = args + f' user: User = Depends(RequirePermissions("{permission}"))'
        else:
            new_args = args + f', user: User = Depends(RequirePermissions("{permission}"))'
            
        return full_match.replace(args, new_args)

    new_content = re.sub(pattern, replacer, content)
    
    with open(filename, 'w') as f:
        f.write(new_content)
    print(f'Updated {filename}')

update_file('apps/api/routes/risks.py', 'risks', 'risk:read')
update_file('apps/api/routes/intelligence.py', 'intelligence', 'intelligence:read')
update_file('apps/api/routes/market.py', 'market', 'world:read')
update_file('apps/api/routes/graph.py', 'graph', 'graph:read')
