import React from 'react';
import { AppProvider, useApp } from './AppContext';
import { Layout } from './components/Layout';
import { Role } from './types';
import { ManagementView } from './views/ManagementView';
import { ReportingView } from './views/ReportingView';
import { MaintenanceView } from './views/MaintenanceView';
import { ReceptionView } from './views/ReceptionView';

const RoleBasedContent: React.FC = () => {
  const { role } = useApp();

  switch (role) {
    case Role.MANAGEMENT:
      return <ManagementView />;
    case Role.MAINTENANCE:
      return <MaintenanceView />;
    case Role.CLEANING:
      return <ReportingView />;
    case Role.RECEPTION:
      return <ReceptionView />;
    default:
      return <div>Role not recognized</div>;
  }
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Layout>
        <RoleBasedContent />
      </Layout>
    </AppProvider>
  );
};

export default App;
