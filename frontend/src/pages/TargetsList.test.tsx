import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TargetsList } from './TargetsList';
import { TargetDetail } from './TargetDetail';
import api from '../services/api';
jest.mock('../services/api');
const target = { id: 'target-id', name: 'My server', type: 'server', address: '127.0.0.1', enabled: true, status: 'unknown', description: '', created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' };
beforeEach(() => {
 jest.clearAllMocks();
 (api.getTargets as jest.Mock).mockResolvedValue([]);
 jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
function page() { return render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><TargetsList /></MemoryRouter>); }
async function openForm() {
 fireEvent.click(await screen.findByRole('button', {name:'+ Add Target'}));
 fireEvent.change(screen.getByLabelText('Name *'),{target:{value:'My server'}});
 fireEvent.change(screen.getByLabelText('Address *'),{target:{value:'127.0.0.1'}});
 fireEvent.change(screen.getByLabelText('Type *'),{target:{value:'server'}});
}
test('creates a target and refreshes the target cards',async()=>{
 (api.createTarget as jest.Mock).mockResolvedValue(target);
 page();await openForm();
 (api.getTargets as jest.Mock).mockResolvedValue([target]);
 fireEvent.click(screen.getByRole('button',{name:'Create Target'}));
 expect(await screen.findByRole('link',{name:/My server/})).toHaveAttribute('href','/app/targets/target-id');
 expect(api.createTarget).toHaveBeenCalledWith(expect.objectContaining({name:'My server',type:'server',address:'127.0.0.1'}));
 expect(screen.queryByRole('dialog')).toBeNull();
});
test('retains input and shows a server error inside the modal',async()=>{
 (api.createTarget as jest.Mock).mockRejectedValue(new Error('A target with this address and port already exists'));
 page();await openForm();fireEvent.click(screen.getByRole('button',{name:'Create Target'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
 expect(screen.getByLabelText('Name *')).toHaveValue('My server');
 expect(screen.getByRole('dialog')).toBeInTheDocument();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create Target'})).toBeEnabled());
});
test('renders a newly saved target as unknown instead of crashing',async()=>{
 (api.getTarget as jest.Mock).mockResolvedValue(target);
 render(<MemoryRouter initialEntries={['/app/targets/target-id']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Routes><Route path='/app/targets/:id' element={<TargetDetail/>}/></Routes></MemoryRouter>);
 expect(await screen.findByRole('heading',{name:'My server'})).toBeInTheDocument();
 expect(screen.getByRole('status')).toHaveTextContent('No monitoring measurements');
 expect(screen.getByRole('link',{name:/Back to Targets/})).toHaveAttribute('href','/app/targets');
});
